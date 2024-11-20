require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const rateLimit = require('express-rate-limit');
const passport = require('passport');
require('./middlewares/passport-setup'); 
const {verifyToken} = require('./middlewares/auth')
const mongoSanitize = require('express-mongo-sanitize');
// Initialize your queues
const qrCodeQueue = require('./queues/qrCodeQueue');
const customerOnboardingQueue = require('./queues/customerOnboardingQueue');
const basicAuth = require('express-basic-auth');

const logger = require('./utils/logger');
// app.js

const { BullAdapter } = require('@bull-board/api/bullAdapter');
const { createBullBoard } = require('@bull-board/api');
const { ExpressAdapter } = require('@bull-board/express');



const app = express();




// Set up Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues'); // Set the base path for Bull Board

createBullBoard({
  queues: [
    new BullAdapter(qrCodeQueue),
    new BullAdapter(customerOnboardingQueue),
  ],
  serverAdapter,
});

// Mount Bull Board to your app
app.use(
  '/admin/queues',
  basicAuth({
    users: { [process.env.BULL_USERNAME]: process.env.BULL_PASSWORD },
    challenge: true,
  }),
  serverAdapter.getRouter()
);
;




// Security Middlewares

// Configure to accept requests from your React app's domain


app.use(helmet());

app.use((req, res, next) => {
  let oldWrite = res.write;
  let oldEnd = res.end;

  let chunks = [];

  res.write = function (chunk) {
    if (typeof chunk === 'string' || chunk instanceof Buffer) {
      chunks.push(Buffer.from(chunk));
    } else {
      // Convert object to JSON string before creating Buffer
      chunks.push(Buffer.from(JSON.stringify(chunk)));
    }
    oldWrite.apply(res, arguments);
  };

  res.end = function (chunk) {
    if (chunk) {
      if (typeof chunk === 'string' || chunk instanceof Buffer) {
        chunks.push(Buffer.from(chunk));
      } else {
        // Convert object to JSON string before creating Buffer
        chunks.push(Buffer.from(JSON.stringify(chunk)));
      }
    }
    let body = Buffer.concat(chunks).toString('utf8');

    if (req.path.includes('/short-logs')) {
      logger.info("Shortened log for", req.path);
    } else {
      logger.info(`${req.method} ${req.url} ${res.statusCode} - ${body.slice(0, 500)}...`); // Logs only the first 500 characters
    }
    oldEnd.apply(res, arguments);
  };

  next();
});



// Body Parsing
app.use(express.json());

// Session Management
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI })
}));

// Passport Initialization
app.use(passport.initialize());
app.use(passport.session());

// Data Sanitization against NoSQL Injection
app.use(mongoSanitize());

// Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per 15 minutes
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Database Connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => logger.info('MongoDB Connected'))
.catch(err => logger.error('MongoDB connection error:', err));


const corsOptions = {
  origin: function (origin, callback) {
    const whitelist = [
      'http://localhost:3000',
      'https://bountyfe-git-auth-omchillures-projects.vercel.app',
      'https://bountyfe.vercel.app',
      'https://app.huntbounty.xyz'
    ];
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions)); // Enable preflight across the board

app.use((req, res, next) => {
  logger.info('Received request with headers:', req.headers);
  next();
});
app.use((req, res, next) => {
  console.log('Headers:', req.headers);
  console.log('Authorization:', req.headers.authorization);
  next();
});

app.use((err, req, res, _next) => {
  res.status(err.status || 500).json({
      error: {
          message: err.message || 'Internal Server Error'
      }
  });
});


// API Routes
// app.use('/api', (req, res, next) => {
//   if (req.path.startsWith('/external/')) {
//     // Skip authentication for /api/external/* routes
//     return next();
//   } else {
//     return isAuthenticated(req, res, next);
//   }
// });

// API Routes with specific middleware
app.use('/auth', require('./routes/googleuser'));//Google SSO 
//app.use('/api/users', require('./routes/users')); // Users might only need session check
app.use('/api/companies', verifyToken, require('./routes/companies')); // Companies might require token validation
app.use('/api/campaigns', verifyToken,require('./routes/campaigns')); // Assume default session check from global
app.use('/api/payments', verifyToken, require('./routes/payments')); // Payments might require enhanced security with tokens
app.use('/external', require('./routes/external'));

// Error Handling Middleware
const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

// Start server
const PORT = process.env.PORT || 5001;
// Start server only if this file is run directly, not when imported
if (require.main === module) {
  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

// Export the app for testing purposes
module.exports = app;
