const express = require('express');
require('dotenv').config();                         //dotenv
const cors = require('cors');                        //cors
const port = process.env.PORT || 5000;
const app = express();
const jwt = require('jsonwebtoken');                 //jwt

//middleware
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));


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
        const verifyToken = async (req, resp, next) => {
            const token = req?.headers?.authorization.split(" ")[1];
            if (!token) return resp.status(401).send({ message: 'Unauthorized Access' });

            await jwt.verify(token, process.env.TOP_SECRET, (err, decoded) => {
                if (err) return resp.status(401).send({ message: 'Unauthorized Access' });
                else req.decoded = decoded;
                next();
            });
        };
        //jwt
        app.post('/jwt', async (req, resp) => {
            const user = req?.body;
            const token = await jwt.sign(user, process.env.TOP_SECRET, { expiresIn: '1h' })
            resp.send({ token });
        });
        //get all users
        app.get('/users', verifyToken, async (req, resp) => {
            const result = await users.find().toArray();
            resp.send(result);
        });
        //check user or not
        app.get('/user', async (req, resp) => {
            const { email } = req.query;
            const result = await users.findOne({ email: email });
            if (result) resp.send({ isRegistered: true });
            else
                resp.send({ isRegistered: false });
        });
        //add/post a user
        app.post('/user', async (req, resp) => {
            const user = req.body;
            const result = await users.insertOne(user);
            resp.send(result);
        });
        //get user role
        //get all products
        //get a product
        //post a product
        //update a product
        //get all payments
        //post a payment








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