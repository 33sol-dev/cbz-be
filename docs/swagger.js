// swagger.js

const swaggerJSDoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'Bounty API Documentation',
    version: '1.0.0',
    description: 'API documentation for the Bounty application',
    contact: {
      name: 'VS',
      email: 'vishal@33-sol.com',
    },
    license: {
      name: 'MIT',
      url: 'https://opensource.org/licenses/MIT',
    },
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Development server',
    },
    {
      url: 'https://bounty.33solutions.dev/',
      description: 'Production server',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter your JWT token in the format **Bearer &lt;token>**',
      },
    },
    schemas: {
      Campaign: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            example: '60f7c0b5d4d3c81234567890',
          },
          user: {
            type: 'string',
            example: '60f7c0b5d4d3c81234567890',
          },
          company: {
            $ref: '#/components/schemas/Company',
          },
          name: {
            type: 'string',
            example: 'Festive Campaign',
          },
          description: {
            type: 'string',
            example: 'Campaign for the festive season with QR code rewards.',
          },
          totalAmount: {
            type: 'number',
            example: 1000,
          },
          tags: {
            type: 'array',
            items: {
              type: 'string',
            },
            example: ['festive', 'holiday'],
          },
          status: {
            type: 'string',
            example: 'Pending',
          },
          messageTemplate: {
            type: 'string',
            example: 'Welcome to our campaign!',
          },
          zipUrl: {
            type: 'string',
            example: 'http://example.com/path/to/zipfile.zip',
          },
          payoutConfig: {
            type: 'object',
            description: 'Payout configuration settings',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
      Company: {
        type: 'object',
        properties: {
          _id: {
            type: 'string',
            example: '60f7c0b5d4d3c81234567890',
          },
          name: {
            type: 'string',
            example: 'ABC Corp',
          },
          user: {
            type: 'string',
            example: '60f7c0b5d4d3c81234567890',
          },
          plan: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                example: 'Elite Pro',
              },
              qrCodeLimit: {
                type: 'integer',
                example: 1000,
              },
              qrCodesGenerated: {
                type: 'integer',
                example: 100,
              },
            },
          },
          whatsappNumber: {
            type: 'string',
            example: '+1234567890',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
          },
          updatedAt: {
            type: 'string',
            format: 'date-time',
          },
        },
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
};

const options = {
  swaggerDefinition,
  // Paths to files containing OpenAPI definitions
  apis: ['./routes/*.js'],
};

const swaggerSpec = swaggerJSDoc(options);

module.exports = swaggerSpec;
