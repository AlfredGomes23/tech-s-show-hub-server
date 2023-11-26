const express = require('express');
require('dotenv').config();                         //dotenv
const cors = require('cors');                        //cors
const port = process.env.PORT || 5000 ;
const app = express();
const jwt = require('jsonwebtoken');                 //jwt

//middleware
app.use(express.json());
app.use(cors());

app.get('/', (req, resp) => {
    resp.send("Tech's Show Hub is running.")
});

app.listen(port, async () => {
    console.log('Hub is running.');
});