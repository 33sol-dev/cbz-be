// app.js
require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const rateLimit = require("express-rate-limit");
const passport = require("passport");
require("./middlewares/passport-setup");
const { verifyToken } = require("./middlewares/auth");
const mongoSanitize = require("express-mongo-sanitize");
const qrCodeQueue = require("./queues/qrCodeQueue");
const customerOnboardingQueue = require("./queues/customerOnboardingQueue");
const basicAuth = require("express-basic-auth");
const logger = require("./utils/logger");
const { BullAdapter } = require("@bull-board/api/bullAdapter");
const { createBullBoard } = require("@bull-board/api");
const { ExpressAdapter } = require("@bull-board/express");
const { body, validationResult } = require("express-validator");
const constants = require("./config/constants")

const app = express();

// Security Middlewares
app.use(helmet());

// Set up Bull Board
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
createBullBoard({
  queues: [
    new BullAdapter(qrCodeQueue),
    new BullAdapter(customerOnboardingQueue),
  ],
  serverAdapter,
});

// Mount Bull Board to your app (with basic auth)
app.use(
  "/admin/queues",
  basicAuth({
    users: { [process.env.BULL_USERNAME]: process.env.BULL_PASSWORD },
    challenge: true,
  }),
  serverAdapter.getRouter()
);

// Request Logging Middleware (Improved)
app.use((req, res, next) => {
  const startTime = Date.now();
  const oldWrite = res.write;
  const oldEnd = res.end;
  const chunks = [];

  res.write = function (chunk) {
    if (chunk) {
      chunks.push(Buffer.from(chunk));
    }
    oldWrite.apply(res, arguments);
  };

  res.end = function (chunk) {
    if (chunk) {
      chunks.push(Buffer.from(chunk));
    }
    const body = Buffer.concat(chunks).toString("utf8");
    const duration = Date.now() - startTime;

    // Customize logging based on URL (optional)
    if (req.path.includes("/short-logs")) {
      logger.info(`Shortened log for ${req.path}`);
    } else {
      logger.info(
        `${req.method} ${req.url} ${res.statusCode} - ${duration}ms - ${body.slice(
          0,
          500
        )}...`
      ); // Log first 500 characters
    }

    oldEnd.apply(res, arguments);
  };

  next();
});


// Body Parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Session Management
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
    cookie: {
      secure: process.env.NODE_ENV === "production", // Use secure cookies in production
      httpOnly: true,
      maxAge: 1000 * 60 * 60 * 24, // 1 day
    },
  })
);

// Passport Initialization
app.use(passport.initialize());
app.use(passport.session());

// Data Sanitization against NoSQL Injection
app.use(mongoSanitize());

// Rate Limiting Middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);
app.set("trust proxy", 1); // Trust first proxy (important for rate limiting behind proxies)


// Database Connection
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => logger.info("MongoDB Connected"))
  .catch((err) => logger.error("MongoDB connection error:", err));

const corsOptions = {
    origin: function (origin, callback) {
      if (constants.whitelist.indexOf(origin) !== -1 || !origin) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    allowedHeaders: ["Content-Type", "Authorization"],
  };
  app.get("/qrscan", (req, res) => {
    console.log(constants.verifyToken)
    const verifyToken = constants.verifyToken;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode && token === verifyToken) {
      logger.info("Webhook verified successfully.");
      res.status(200).send(challenge);
    } else {
      logger.warn("Webhook verification failed.");
      res.status(403).send("Verification failed.");
    }
  });
  app.post("/qrscan", express.json(), async (req, res) => {
    try {
      const { object, entry } = req.body;
      // Check if the webhook is for WhatsApp messages
      if (object === "whatsapp_business_account") {
        entry.forEach((entryItem) => {
          entryItem.changes.forEach((change) => {
            if (change.field === "messages") {
              const messages = change.value.messages;
              const phoneNumberId = change.value.metadata.phone_number_id;
              messages.forEach(async (message) => {
                if (message.type === "text") {
                  const from = message.from; // Sender's phone number
                  const messageBody = message.text.body;
                  logger.info(`Received message from ${from}: ${messageBody}`);
                  // Respond to the sender (Optional)
                  await axios.post(
                    `${constants.whatsappApiUrl}/messages`,
                    {
                      messaging_product: "whatsapp",
                      to: from,
                      text: {
                        body: "Thanks for your message! We'll get back to you soon.",
                      },
                    },
                    {
                      headers: {
                        Authorization: `Bearer ${constants.whatsappAccessToken}`,
                        "Content-Type": "application/json",
                      },
                    }
                  );
                  logger.info(`Replied to ${from} successfully.`);
                }
              });
            }
          });
        });
      }
      res.sendStatus(200);
    } catch (error) {
      logger.error("Error handling WhatsApp message:", error);
      res.sendStatus(500);
    }
  });
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions)); // Enable preflight across the board
  app.use((req, res, next) => {
    logger.info("Received request with headers:", req.headers);
    next();
  });
  app.use((req, res, next) => {
    console.log("Headers:", req.headers);
    console.log("Authorization:", req.headers.authorization);
    next();
  });

// Centralized Error Handler (Improved)
app.use((err, req, res, next) => {
  logger.error(err.stack); // Log the full error stack

  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  res.status(statusCode).json({
    error: {
      message,
    },
  });
});



app.get("/", (req, res) => {
  res.send("Hello World!");
});

// API Routes
app.use("/auth", require("./routes/googleuser")); // Google SSO
app.use("/api/companies", verifyToken, require("./routes/companies"));
app.use("/api/campaigns", require("./routes/campaigns"));
app.use("/api/payments", verifyToken, require("./routes/payments"));
app.use("/external", require("./routes/external"));
app.use("/analytics", require("./routes/analytics"));
app.use("/api/merchant", require("./routes/merchant"));
app.use("/api/code", require("./routes/codeRoute"));

// Error Handling Middleware (Keep this at the end)
const errorHandler = require("./middlewares/errorHandler");
app.use(errorHandler);


// Start server
const PORT = process.env.PORT || 5001;

// Start server only if this file is run directly, not when imported
if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    logger.info(`Server running on port ${PORT}`);
  });
}

// Export the app for testing purposes
module.exports = app;