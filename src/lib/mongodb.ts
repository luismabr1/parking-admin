import { MongoClient } from "mongodb"
require("dotenv").config({ path: ".env" })

if (!process.env.MONGODB_URI) {
  throw new Error(
    'Invalid/Missing environment variable: "MONGODB_URI". Please set it in the .env file (e.g., MONGODB_URI=mongodb://localhost:27017/parking).',
  )
}

const uri = process.env.MONGODB_URI

if (!uri) {
  console.error("Error: MONGODB_URI no está definido en las variables de entorno")
  console.error("Asegúrate de tener un archivo .env.local con la variable MONGODB_URI")
  process.exit(1)
}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (process.env.NODE_ENV === "development") {
  const globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>
  }

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri)
    globalWithMongo._mongoClientPromise = client.connect()
    console.log("MongoDB client initialized in development mode")
  }
  clientPromise = globalWithMongo._mongoClientPromise
} else {
  client = new MongoClient(uri)
  clientPromise = client.connect()
  console.log("MongoDB client initialized in production mode")
}

export async function connectToDatabase() {
  const client = await clientPromise
  const db = client.db("parking")
  return { client, db }
}

export default clientPromise
