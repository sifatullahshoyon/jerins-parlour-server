const express = require("express");
require("dotenv").config();
const app = express();
const jwt = require("jsonwebtoken");
const morgan = require("morgan");
const cors = require("cors");
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);

const multer = require("multer");
const {
  MongoClient,
  ServerApiVersion,
  ObjectId,
  GridFSBucket,
} = require("mongodb");
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

// jwt middleware
const verifyToken = (req, res, next) => {
  // console.log('inside verify token' ,req.headers.authorization);
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "Unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

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

    const serviceCollection = client
      .db("jerinsParlour_DB")
      .collection("services");
    const cartCollection = client.db("jerinsParlour_DB").collection("carts");
    const userCollection = client.db("jerinsParlour_DB").collection("users");
    const paymentCollection = client
      .db("jerinsParlour_DB")
      .collection("payments");

    // jwt related api:
    app.post("/jwt", async (req, res) => {
      try {
        const user = req.body;
        const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
          expiresIn: "1h",
        });
        res.send({ token });
      } catch (error) {
        console.error("jwt error", error);
      }
    });

    // use verify admin after verify Token
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // User Related Apis:-
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const result = await userCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching users", error);
      }
    });

    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      // let admin = false;
      // if(user){
      //     admin = user?.role === 'admin';
      // }
      const admin = user?.role === "admin";
      res.send({ admin });
    });

    app.post("/users", async (req, res) => {
      try {
        const user = req.body;
        const query = { email: user.email };
        const existingUser = await userCollection.findOne(query);
        if (existingUser) {
          return res.send({ message: "user already Exists", insertedId: null });
        }
        const result = await userCollection.insertOne(user);
        res.send(result);
      } catch (error) {
        console.error("User Info Add To The Database", error);
      }
    });

    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const id = req.params.id;
          const filter = { _id: new ObjectId(id) };
          const updateDoc = {
            $set: {
              role: "admin",
            },
          };
          const result = await userCollection.updateOne(filter, updateDoc);
          res.send(result);
        } catch (error) {
          console.error("Error Update Single user role", error);
        }
      }
    );

    app.delete("/users/:id", verifyToken, verifyToken, async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error Delete Single user", error);
      }
    });

    // Service
    app.get("/services", async (req, res) => {
      try {
        const result = await serviceCollection.find().toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching services", error);
      }
    });

    app.get("/services/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await serviceCollection.findOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error fetching services", error);
      }
    });

    app.post("/services", verifyToken, verifyAdmin, async (req, res) => {
      const cartItem = req.body;
      const result = await serviceCollection.insertOne(cartItem);
      res.send(result);
    });

    app.patch("/services/:id", verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const items = req.body;
      console.log("🚀 ~ app.patch ~ cartItem:", items )
      
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          cartItem: items 
        },
      };
      const result = await serviceCollection.updateOne(filter , updateDoc);
      res.send(result);
    });

    app.delete("/services/:id", verifyToken , verifyAdmin, async (req, res) => {
      try {
        const id = req.params.id;
        console.log("🚀 ~ app.delete ~ id:", id)
        
        const query = { _id: new ObjectId(id) };
        const result = await serviceCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error Delete Single item", error);
      }
    });

    // Carts:-
    app.get("/carts", async (req, res) => {
      try {
        const email = req.query.email;
        const query = { email: email };
        const result = await cartCollection.find(query).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching carts", error);
      }
    });

    app.post("/carts", async (req, res) => {
      try {
        const cartItem = req.body;
        const result = await cartCollection.insertOne(cartItem);
        res.send(result);
      } catch (error) {
        console.error("Error Add Item To The Database", error);
      }
    });

    app.delete("/carts/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) };
        const result = await cartCollection.deleteOne(query);
        res.send(result);
      } catch (error) {
        console.error("Error Delete Single Item", error);
      }
    });

    // Image Upload On server:-
    // const serviceCollection = client.db("jerinsParlour_DB").collection("services");
    // const bucket = new GridFSBucket(serviceCollection, { bucketName: 'uploads' });
    // Create storage engine
    // const storage = multer.memoryStorage();
    // const upload = multer({ storage });

    // app.post('/upload', upload.single('image'), (req, res) => {
    //     const file = req.file;

    //     if (!file) {
    //       return res.status(400).send('No file uploaded.');
    //     }

    //     const uploadStream = bucket.openUploadStream(file.image);
    //     uploadStream.end(file.buffer);

    //     uploadStream.on('finish', () => {
    //       res.status(201).json({ file: file.originalname });
    //     });

    //     uploadStream.on('error', (error) => {
    //       console.error('Upload error:', error);
    //       res.status(500).send('Error uploading file.');
    //     });
    //   });

    // Payment API:
    app.post("/create-payment-intent", verifyToken, async (req, res) => {
      const { price } = req.body;
      const amount = parseFloat(price * 100);

      // Create a PaymentIntent with the order amount and currency
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    app.post("/payments", verifyToken, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      const query = {
        _id: { $in: payment.cartItemsId.map((id) => new ObjectId(id)) },
      };
      const deleteResult = await cartCollection.deleteMany(query);

      res.send({ insertResult, deleteResult });
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
