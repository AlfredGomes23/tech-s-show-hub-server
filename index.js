const express = require('express');
require('dotenv').config();                         //dotenv
const cors = require('cors');                        //cors
const port = process.env.PORT || 5000 ;
const app = express();
const jwt = require('jsonwebtoken');                 //jwt

//middleware
app.use(express.json());
app.use(cors());


const { MongoClient, ServerApiVersion } = require('mongodb');

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(process.env.DB_URI, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        //db collections
        const users = client.db("tech's-show-hub").collection('users');
        //custom middlewares
        //apis
        app.get('/users', async (req, resp) => {
            const result = await users.find().toArray();
            resp.send(result);
        });








        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get('/', (req, resp) => {
    resp.send("Tech's Show Hub is running.")
});

app.listen(port, () => {
    console.log('Hub is running.');
});