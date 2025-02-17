// middlewares/parse-form-data.js
const parseFormData = (fieldsToParse) => {
    return (req, res, next) => {
        if (req.body) {
            fieldsToParse.forEach(field => {
                if (req.body[field] && typeof req.body[field] === 'string') {
                    try {
                        req.body[field] = JSON.parse(req.body[field]);
                    } catch (error) {
                        // Handle parsing errors (e.g., invalid JSON)
                        console.error(`Error parsing ${field}:`, error);
                        // You might want to return a 400 Bad Request here,
                        // but for now, we'll just log the error and continue
                        // res.status(400).json({ message: `Invalid JSON in ${field}` });
                    }
                }
            });
        }
        next();
    };
};

module.exports = parseFormData;