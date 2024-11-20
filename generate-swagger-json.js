// generate-swagger-json.js

const fs = require('fs');
const swaggerSpec = require('./docs/swagger'); // Adjust the path if necessary

fs.writeFileSync('./docs/swagger.json', JSON.stringify(swaggerSpec, null, 2), 'utf-8');
console.log('Swagger JSON file generated at ./docs/swagger.json');
