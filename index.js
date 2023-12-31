const express = require('express');
require('dotenv').config();                         //dotenv
const cors = require('cors');                        //cors
const port = process.env.PORT || 5000;
const app = express();
const jwt = require('jsonwebtoken');                        //jwt
const stripe = require('stripe')(process.env.SUPER_SECRET);                 //strip

//middleware
app.use(express.json());
app.use(cors({
    origin: ['http://localhost:5173', 'https://dazzling-chimera-e53bd5.netlify.app', 'https://tech-s-show-hub.web.app', 'https://tech-s-show-hub.firebaseapp.com'],
    credentials: true
}));


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

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
        // await client.connect();


        //db collections
        const users = client.db("tech's-show-hub").collection('users');
        const products = client.db("tech's-show-hub").collection('products');
        const coupons = client.db("tech's-show-hub").collection('coupons');


        //custom middlewares
        const verifyToken = async (req, resp, next) => {
            const token = req?.headers?.authorization?.split(" ")[1];
            if (!token) return resp.status(401).send({ message: 'Unauthorized Access' });

            await jwt.verify(token, process.env.TOP_SECRET, (err, decoded) => {
                if (err) return resp.status(401).send({ message: 'Unauthorized Access' });
                else req.decoded = decoded;
                next();
            });
        };
        const isModerator = async (req, resp, next) => {
            const { email } = req.decoded;
            const { role } = await users.findOne({ email: email });
            if (role !== "Moderator") return resp.status(403).send({ message: 'Forbidden Access' });
            next();
        };
        const isAdmin = async (req, resp, next) => {
            const { email } = req.decoded;
            const { role } = await users.findOne({ email: email });
            if (role !== "Admin") return resp.status(403).send({ message: 'Forbidden Access' });
            next();
        };


        //jwt
        app.post('/jwt', async (req, resp) => {
            const user = req?.body;
            const token = await jwt.sign(user, process.env.TOP_SECRET, { expiresIn: '1h' })
            resp.send({ token });
        });



        //get all users
        app.get('/users', verifyToken, isAdmin, async (req, resp) => {
            const result = await users.find().toArray();
            resp.send(result);
        });
        //get a user
        app.get('/user', async (req, resp) => {
            const { email } = req.query;
            const result = await users.findOne({ email: email });
            resp.send(result);
        });
        //add/post a user
        app.post('/user', verifyToken, async (req, resp) => {
            const user = req.body;
            const result = await users.insertOne(user);
            resp.send(result);
        });
        //update user to subscriber
        app.patch('/user', verifyToken, async (req, resp) => {
            const { email, role, t_id } = req.body;
            const result = await users.updateOne({ email: email }, {
                $set: { role: role, limit: 9999, t_id: t_id }
            });
            resp.send(result);
        });
        //update user role
        app.patch('/user/:id', verifyToken, isAdmin, async (req, resp) => {
            const id = req.params.id;
            const { role } = req.body;
            const result = await users.updateOne({ _id: new ObjectId(id) }, { $set: { role: role } });
            resp.send(result);
        });


        //get products count
        app.get('/productsCount', async (req, resp) => {
            const { tag } = req.query;
            let count = 0;
            if (tag) count = await products.countDocuments({ "status": "Accepted", tags: { $regex: new RegExp(tag, 'i') } }); 
            else count = await products.countDocuments({ "status": "Accepted" });
            resp.send({ count });
        });
        //get all products
        app.get('/products', async (req, resp) => {
            const { page, limit, search } = req.query;

            let result = await products.find({ "status": "Accepted", tags: { $regex: new RegExp(search, 'i') } })
                .sort({ posted: -1 })
                .skip(+page * +limit)
                .limit(+limit)
                .toArray();
            //if any of tag didn't matched then send all 
            if (result.length === 0) result = await products.find({ "status": "Accepted" }).sort({ posted: -1 }).skip(+page * +limit).limit(+limit).toArray();

            resp.send(result);
        });
        //get trading products
        app.get('/trending', async (req, resp) => {
            const result = await products.aggregate([
                {   //add a counter field
                    $addFields: {
                        upvoteCount: {
                            $cond: { //condition to handle empty arrays
                                if: { $isArray: "$upvotes" },
                                then: { $size: "$upvotes" },
                                else: 0
                            }
                        }
                    }
                },
                {//sort by count
                    $sort: { upvoteCount: -1 }
                },
                {// remove counter from product object
                    $project: { upvoteCount: 0 }
                }
            ]).limit(6).toArray();
            resp.send(result);
        });
        //get a product
        app.get('/product/:id', async (req, resp) => {
            const id = req.params.id;
            const result = await products.findOne({ _id: new ObjectId(id) });
            resp.send(result);
        });
        //get a users products
        app.get('/products/:email', verifyToken, async (req, resp) => {
            const email = req.params.email;
            const result = await products.find({ "ownerEmail": email }).toArray();
            resp.send(result);
        });
        //get pending products
        app.get('/pending-products', verifyToken, isModerator, async (req, resp) => {
            const result = await products.find({ "status": { $in: ["Pending", "Rejected"] } }).sort({ posted: -1 }).toArray();
            resp.send(result);
        });
        //get all reported products
        app.get('/reported-products', verifyToken, isModerator, async (req, resp) => {
            const result = await products.find({ "reported": true }).toArray();
            resp.send(result)
        });
        //post a product
        app.post('/product', verifyToken, async (req, resp) => {
            const product = req.body;
            const result = await products.insertOne(product);
            if (result) await users.updateOne({ email: product.ownerEmail }, { $inc: { limit: -1 } });
            resp.send(result);
        });
        //post a review
        app.post('/review/:id', verifyToken, async (req, resp) => {
            const id = req.params.id;
            const { email, name, comment, rating } = req.body;
            const result = await products.updateOne({ _id: new ObjectId(id) }, { $push: { "reviews": req.body } }
            );
            resp.send(result);
        });
        //update a product
        app.patch('/product/update/:id', verifyToken, async (req, resp) => {
            const id = req.params.id;

            const update = {
                $set: req.body
            };
            const result = await products.updateOne({ _id: new ObjectId(id) }, update);
            resp.send(result);
        });
        //update a pending product
        app.patch('/pending-product/update/:id', verifyToken, isModerator, async (req, resp) => {
            const id = req.params.id;

            const update = {
                $set: req.body
            };
            const result = await products.updateOne({ _id: new ObjectId(id) }, update);
            resp.send(result);
        });
        //update vote
        app.patch('/product/vote/:id', verifyToken, async (req, resp) => {
            const id = req.params;
            const { email, vote } = req.query;
            const result = await products.updateOne({ _id: new ObjectId(id) },
                {
                    $push: { [vote]: email }
                });
            resp.send(result)
        });
        //report a product
        app.patch('/report/:id', verifyToken, async (req, resp) => {
            const id = req.params.id;
            const result = await products.updateOne({ _id: new ObjectId(id) },
                { $set: { "reported": true } });
            resp.send(result);
        });
        //delete a product
        app.delete('/product/:id', verifyToken, async (req, resp) => {
            const id = req.params.id;
            const { ownerEmail } = await products.findOne({ _id: new ObjectId(id) });
            const result = await products.deleteOne({ _id: new ObjectId(id) });
            if (result) await users.updateOne({ email: ownerEmail }, { $inc: { limit: 1 } });
            resp.send(result);
        });



        //intend a payment
        app.post('/payment-intent', verifyToken, async (req, resp) => {
            const amount = req.body.amount;
            const paymentIntent = await stripe.paymentIntents.create({
                amount: parseInt(amount * 100),
                currency: 'usd',
                payment_method_types: ['card']
            });
            resp.send({
                clientSecret: paymentIntent.client_secret
            });
        });




        //get stats
        app.get('/admin-stats', verifyToken, isAdmin, async (req, resp) => {
            const usersCount = await users.estimatedDocumentCount();
            const productsCount = await products.estimatedDocumentCount();
            const [{ totalReviews }] = await products.aggregate([
                {
                    $project: { totalReview: { $size: "$reviews" } }
                },
                {
                    $group: {
                        _id: null,
                        totalReviews: { $sum: "$totalReview" }
                    }
                }
            ]).toArray();
            resp.send([
                { name: "Products", value: productsCount },
                { name: "Reviews", value: totalReviews },
                { name: "Users", value: usersCount }
            ]);
        });

        //get all coupons
        app.get('/coupons', async (req, resp) => {
            const result = await coupons.find().toArray();
            resp.send(result);
        });
        //add a coupon
        app.post('/coupon', verifyToken, isAdmin, async (req, resp) => {
            const result = await coupons.insertOne(req.body);
            resp.send(result);
        });
        //update a coupon
        app.patch('/coupon/:id', async (req, resp) => {
            const id = req.params.id;
            const result = await coupons.updateOne({ _id: new ObjectId(id) }, { $set: req.body });
            resp.send(result);
        });
        //delete a coupon
        app.delete('/coupon/:id', verifyToken, isAdmin, async (req, resp) => {
            const id = req.params.id;
            const result = await coupons.deleteOne({ _id: new ObjectId(id) });
            resp.send(result);
        });


        // Send a ping to confirm a successful connection
        // await client.db("admin").command({ ping: 1 });
        // console.log("Pinged your deployment. You successfully connected to MongoDB!");
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