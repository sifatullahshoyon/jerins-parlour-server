const express = require("express");
require("dotenv").config();
const app = express();
const morgan = require("morgan");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const port = process.env.port || 5000;

// middleware
const corsConfig = {
  origin: "*",
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
};
app.options("", cors(corsConfig));
app.use(cors(corsConfig));

app.use(express.json());
app.use(morgan("dev"));

// END middleware

app.get("/", (req, res) => {
  res.send("Jerins Parlour Server Is Running.");
});

//   START MONGODB
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.6khd2rb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    //   await client.connect();

    const serviceCollection = client.db('jerinsParlour_DB').collection('services');
    const cartCollection = client.db('jerinsParlour_DB').collection('carts');


    // Service
    app.get('/services' , async (req, res) => {
        try {
            const result = await serviceCollection.find().toArray();
            res.send(result);
        } catch (error) {
            console.error("Error fetching services", err);
            res.status(500).send({ error: "Error fetching services" });
        }
    });

    // app.post('/services' , async(req,res) => {
    //     const cartItem = req.body;
    //     const result = await serviceCollection.insertOne(cartItem);
    //     res.send(result);
    // });

    // Carts:-
    app.get('/carts', async (req, res) => {
        try {
            const email = req.query.email;
            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
            
        } catch (error) {
            console.error("Error fetching carts", err);
            res.status(500).send({ error: "Error fetching carts" });
        }
    });

    app.post('/carts' , async (req, res) => {
        try {
            const cartItem = req.body;
            const result = await cartCollection.insertOne(cartItem);
            res.send(result);
            
        } catch (error) {
            console.error("Error Add Item To The Database", err);
            res.status(500).send({ error: "Add Item To The Database" });
        }
    });


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //   await client.close();
  }
}
run().catch(console.dir);

// END MONGODB

//   END
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
