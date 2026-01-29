const express = require('express');
const PushNotifications = require('@pusher/push-notifications-server');
const cors = require('cors');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const multer = require('multer');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
require('dotenv').config();

const HISTORY_FILE = path.join(__dirname, 'history.json');

const app = express();

// Security middleware
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ['\'self\''],
                scriptSrc: ['\'self\'', 'https://js.pusher.com'],
                styleSrc: ['\'self\'', '\'unsafe-inline\'', 'https://fonts.googleapis.com'],
                imgSrc: ['\'self\'', 'data:', 'https:', 'http:'],
                fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
                connectSrc: ['\'self\'', 'https://*.pusher.com', 'wss://*.pusher.com'],
            },
        },
    })
);

// Additional security headers
app.use(
    helmet.hsts({
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
    })
);
app.use(helmet.noSniff());
app.use(helmet.frameguard({ action: 'deny' }));

// CORS configuration
const corsOptions = {
    origin: (origin, callback) => {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
            'http://localhost:3000',
            'https://josealvarezdev.github.io',
        ];
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.static('public'));

// Rate limiting for send endpoint
const sendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: { error: 'Demasiadas solicitudes. Por favor, intenta de nuevo más tarde.' },
    standardHeaders: true,
    legacyHeaders: false,
});

// Configure Multer for storage with validation
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/uploads/';
        // Ensure directory exists
        if (!fsSync.existsSync(uploadDir)) {
            fsSync.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        }
        cb(new Error('Solo se permiten imágenes (JPEG, PNG, GIF, WebP)'));
    },
});

const beamsClient =
    process.env.PUSHER_INSTANCE_ID && process.env.PUSHER_SECRET_KEY
        ? new PushNotifications({
            instanceId: process.env.PUSHER_INSTANCE_ID,
            secretKey: process.env.PUSHER_SECRET_KEY,
        })
        : null;

// Validation helper
function validateNotification(data) {
    const errors = [];

    if (!data.title || validator.isEmpty(data.title.trim())) {
        errors.push('El título es obligatorio');
    } else if (data.title.length > 100) {
        errors.push('El título no puede exceder 100 caracteres');
    }

    if (!data.body || validator.isEmpty(data.body.trim())) {
        errors.push('El mensaje es obligatorio');
    } else if (data.body.length > 500) {
        errors.push('El mensaje no puede exceder 500 caracteres');
    }

    if (!data.interest || validator.isEmpty(data.interest.trim())) {
        errors.push('El interés es obligatorio');
    } else if (!/^[a-z0-9-]+$/.test(data.interest)) {
        errors.push('El interés solo puede contener letras minúsculas, números y guiones');
    }

    if (data.image && !validator.isEmpty(data.image) && !validator.isURL(data.image)) {
        errors.push('La URL de la imagen no es válida');
    }

    return errors;
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        pusherConfigured: !!beamsClient,
    });
});

app.get('/api/config', (req, res) => {
    res.json({ instanceId: process.env.PUSHER_INSTANCE_ID });
});

app.post('/api/send', sendLimiter, upload.single('imageFile'), async (req, res) => {
    if (!beamsClient) {
        return res.status(500).json({
            error: 'Configuración de Pusher incompleta. Por favor, configura el archivo .env con tus credenciales de Pusher Beams.',
        });
    }

    let { title, body, interest, image: imageUrl } = req.body;

    // Sanitize inputs
    title = validator.trim(title || '');
    body = validator.trim(body || '');
    interest = validator.trim(interest || '');
    imageUrl = validator.trim(imageUrl || '');

    // Validate inputs
    const validationErrors = validateNotification({ title, body, interest, image: imageUrl });
    if (validationErrors.length > 0) {
        return res.status(400).json({ error: validationErrors.join(', ') });
    }

    let image = imageUrl;

    // Use uploaded file if present
    if (req.file) {
        image = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    }

    try {
        const payload = {
            apns: {
                aps: {
                    alert: { title, body },
                    'mutable-content': image ? 1 : 0,
                },
            },
            fcm: {
                notification: { title, body, image: image || undefined },
            },
            web: {
                notification: {
                    title,
                    body,
                    icon: image || undefined,
                    image: image || undefined,
                },
            },
        };

        const response = await beamsClient.publishToInterests([interest], payload);

        // Save to history
        const historyItem = {
            id: response.publishId,
            title,
            body,
            interest,
            image,
            timestamp: new Date().toISOString(),
        };

        let history = [];
        try {
            const data = await fs.readFile(HISTORY_FILE, 'utf8');
            history = JSON.parse(data);
        } catch (e) {
            // File doesn't exist or is invalid, start fresh
            console.log('Creating new history file');
        }

        history.unshift(historyItem);
        await fs.writeFile(HISTORY_FILE, JSON.stringify(history.slice(0, 20), null, 2));

        console.log(`✅ Notification sent successfully: ${response.publishId}`);
        res.json({ success: true, publishId: response.publishId });
    } catch (error) {
        console.error('❌ Error sending notification:', error.message);
        console.error('Stack:', error.stack);
        res.status(500).json({ error: 'Error interno al enviar notificación' });
    }
});

app.get('/api/history', async (req, res) => {
    try {
        const data = await fs.readFile(HISTORY_FILE, 'utf8');
        const history = JSON.parse(data);
        res.json(history);
    } catch (e) {
        res.json([]);
    }
});

app.delete('/api/history/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let history = [];
        try {
            const data = await fs.readFile(HISTORY_FILE, 'utf8');
            history = JSON.parse(data);
        } catch (e) {
            return res.status(404).json({ error: 'Historial no encontrado' });
        }

        const filteredHistory = history.filter((item) => item.id !== id);

        if (history.length === filteredHistory.length) {
            return res.status(404).json({ error: 'Notificación no encontrada' });
        }

        await fs.writeFile(HISTORY_FILE, JSON.stringify(filteredHistory, null, 2));
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Error deleting notification:', error);
        res.status(500).json({ error: 'Error al borrar la notificación' });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ error: 'El archivo es demasiado grande. Máximo 5MB.' });
        }
        return res.status(400).json({ error: 'Error al subir el archivo: ' + err.message });
    } else if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
    if (!beamsClient) {
        console.warn('⚠️  Pusher Beams no configurado. Por favor, configura el archivo .env');
    } else {
        console.log('✅ Pusher Beams configurado correctamente');
    }
});
