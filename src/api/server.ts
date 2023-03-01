// exposes proper endpoint and handles api calls

const express = require('express');
import { config } from "dotenv";

export function startserver() {
    config()
    const port = process.env.PORT || 3000;
    const app = express();
    app.get('/', (req, res) => {
        res.send('Cunnime bot up and running ^_^');
    });
    app.listen(port, () => console.log(`Cunnime server listening on port ${port}!`))
    return app
}
