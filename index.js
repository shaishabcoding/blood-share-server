const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const app = express();
const port = process.env.PORT || 5000;

//middlewares
app.use(express.json());
app.use(cors());

const client = new MongoClient(process.env.DB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: false,
    deprecationErrors: true,
  },
});

(async () => {
  await client.connect();
  await client.db("admin").command({ ping: 1 });
  console.log("Pinged your deployment. You successfully connected to MongoDB!");

  const DB = client.db("blood-share");
  const userCollection = DB.collection("users");
  const requestCollection = DB.collection("requests");
  const donationProfileCollection = DB.collection("donationProfiles");

  app.post("/jwt", async (req, res) => {
    const { email } = req.body;
    const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET);
    res.send({ token });
  });

  const verifyToken = (req, res, next) => {
    const token = req.headers.authorization.split(" ")[1];
    if (!token) {
      return res.status(401).send({ message: "unauthorized access 49" });
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
      if (err) {
        console.log("err 56");

        return res.status(401).send({ message: "unauthorized access 55" });
      }
      req.user = { email: decoded };
      next();
    });
  };

  const verifyAdmin = async (req, res, next) => {
    const { email } = req.user;
    const query = { email };
    const userData = await userCollection.findOne(query);
    if (userData.role !== "admin") {
      return res.status(403).send({ message: "forbidden access 44" });
    }
    next();
  };

  app.post("/users", async (req, res) => {
    const user = req.body;
    const query = { email: user.email };
    const existingUser = await userCollection.findOne(query);
    if (existingUser) {
      return res.send({ success: true });
    }
    const result = await userCollection.insertOne(user);
    res.send({ success: true });
  });

  // app routes
  app.post("/blood-request/new", verifyToken, async (req, res) => {
    const data = req.body;
    data.email = req.user.email;
    const result = await requestCollection.insertOne(data);
    res.send(result);
  });

  app.get("/requests", async (req, res) => {
    const result = await requestCollection.find().toArray();
    res.send(result);
  });

  app.get("/requests/my", verifyToken, async (req, res) => {
    const result = await requestCollection
      .find({ email: req.user.email })
      .toArray();
    res.send(result);
  });

  app.get("/donars", async (req, res) => {
    let { bloodGroup, location } = req.query;
    bloodGroup = bloodGroup.replace(" ", "+");

    const donars = await donationProfileCollection
      .find({
        $and: [
          { location: { $regex: location, $options: "i" } },
          { bloodGroup: { $regex: bloodGroup, $options: "i" } },
        ],
      })
      .toArray();
    const donarsCount = await donationProfileCollection.countDocuments();
    res.send({ donars, donarsCount });
  });

  app.get("/donation-profile", verifyToken, async (req, res) => {
    const result = await donationProfileCollection.findOne(
      {
        email: req.user.email,
      },
      {
        projection: {
          email: 0,
          _id: 0,
        },
      }
    );
    res.send(result);
  });

  app.patch("/donation-profile", verifyToken, async (req, res) => {
    const data = req.body;
    data.email = req.user.email;
    const result = await donationProfileCollection.updateOne(
      { email: req.user.email },
      {
        $set: {
          ...data,
        },
      },
      {
        upsert: true,
      }
    );
    res.send(result);
  });

  app.patch("/donation-profile/active", verifyToken, async (req, res) => {
    const data = req.body;
    const result = await donationProfileCollection.updateOne(
      { email: req.user.email },
      {
        $set: {
          ...data,
        },
      },
      {
        upsert: true,
      }
    );
    res.send(result);
  });

  app.delete("/requests/:id", verifyToken, async (req, res) => {
    const result = await requestCollection.deleteOne({
      email: req.user.email,
      _id: new ObjectId(req.params.id),
    });
    res.send(result);
  });
})();

app.get("/", (req, res) => {
  res.send("server is running");
});
app.listen(port, () => {
  console.log("server is running on " + port);
});
