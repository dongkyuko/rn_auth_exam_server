// Welcome to Launchpad!
// Log in to edit and save pads, run queries in GraphiQL on the right.
// Click "Download" above to get a zip with a standalone Node.js server.
// See docs and examples at https://github.com/apollographql/awesome-launchpad

// graphql-tools combines a schema string with resolvers.
import { makeExecutableSchema } from 'graphql-tools';
import { MongoClient, ObjectId } from 'mongodb';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

let mongo;
let client;

// const TEMP_USER = {
//   _id: '1',
//   email: 'blackdark13@naver.com',
// };

const getUser = async (authorization, secrets, mongo) => {
  const bearerLength = "Bearer ".length;
  console.log(authorization);
  if (authorization && authorization.length > bearerLength) {
    const token = authorization.slice(bearerLength);
    const { ok, result } = await new Promise (resolve => {
      jwt.verify(token, secrets.JWT_SECRET, (err, result) => {
        if(err){
          resolve({
            ok:false,
            result:err
          });
        }
        else {
          resolve({
            ok: true,
            result
          });
        }
      })
    })
    // console.log(ok);
    if(ok) {
      console.log(result);
      const Users = mongo.collection('users');
      const user = await Users.findOne({ "_id":ObjectId(result._id) });
      console.log(user);
      return user;
    }
    else {
      console.error(result);
      return null;
    }
  }
  return null;
};

// Construct a schema, using GraphQL schema language
const typeDefs = `

  type User {
    _id: String
    email: String
    jwt: String
  }

  type Query {
    hello: String
    currentUser: User
  }

  type Mutation {
    login(email: String!, password: String!): User
    signup(email: String!, password: String!): User
  }

`;

// Provide resolver functions for your schema fields
const resolvers = {
  Query: {
    hello: (root, args, context) => {
      return 'Hello world!';
    },
    currentUser: (root, args, context) => {
      return context.user;
    }
  },
  Mutation: {
    login: async (root, { email, password }, { mongo, secrets }) => {
      
      const Users = mongo.collection('users');
      const user = await Users.findOne({ email });
      if(!user){
        throw new Error('Email not found');
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if(!validPassword){
        throw new Error('Password is incorrect');
      }

      user.jwt = jwt.sign({_id: user._id}, secrets.JWT_SECRET);

      return user;
    },
    signup: async (root, { email, password }, { mongo, secrets }) => {
  
      console.log(email);
      const Users = mongo.collection('users');
      const existingUser = await Users.findOne({ email });

      if(existingUser) {
        throw new Error('Email already used');s
      }

      const hash = await bcrypt.hash(password, 10);
      await Users.insertOne({
        email,
        password: hash,
      });

      const user = await Users.findOne({ email });
      
      user.jwt = jwt.sign({_id: user._id}, secrets.JWT_SECRET);

      return user;
    }
  }
};

// Required: Export the GraphQL.js schema object as "schema"
export const schema = makeExecutableSchema({
  typeDefs,
  resolvers,
});

// Optional: Export a function to get context from the request. It accepts two
// parameters - headers (lowercased http headers) and secrets (secrets defined
// in secrets section). It must return an object (or a promise resolving to it).
export async function context(headers, secrets) {

  if(!mongo) {
    client = await MongoClient.connect(secrets.MONGO_URL, { useNewUrlParser: true });
    mongo = client.db('graphql-auth-demo-1');
  }

  const user = await getUser(headers['authorization'], secrets, mongo);

  // console.log(mongo);
  // console.log(secrets.MONGO_URL);
  // console.log(headers);

  return {
    headers,
    secrets,
    mongo,
    user
  };
};

// Optional: Export a root value to be passed during execution
// export const rootValue = {};

// Optional: Export a root function, that returns root to be passed
// during execution, accepting headers and secrets. It can return a
// promise. rootFunction takes precedence over rootValue.
// export function rootFunction(headers, secrets) {
//   return {
//     headers,
//     secrets,
//   };
// };
