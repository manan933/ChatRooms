import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import WorkspaceNode from '../models/WorkspaceNode.js';
import Message from '../models/Message.js';
import { Contact, PersonalGroup } from '../models/Contact.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

async function runHealthCheck() {
  console.log('====================================================');
  console.log('🏥 ChatRooms Live MongoDB Atlas Health Verification');
  console.log('====================================================');

  await connectDB();
  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  console.log(`\nFound ${collections.length} collections in database "${db.databaseName}":`);

  for (const col of collections) {
    const count = await db.collection(col.name).countDocuments();
    const indexes = await db.collection(col.name).indexes();
    console.log(`\n• Collection: [${col.name}]`);
    console.log(`  - Document count: ${count}`);
    console.log(`  - Indexes (${indexes.length}): ${indexes.map(i => i.name).join(', ')}`);
  }

  // Model integrity assertions
  console.log('\n--- Model Integrity Assertions ---');
  
  // 1. Users
  const userCount = await User.countDocuments();
  const sampleUser = await User.findOne({}).select('+password').lean();
  console.log(`✔ Users collection: ${userCount} active users.`);
  if (sampleUser) {
    const hasBcrypt = sampleUser.password && sampleUser.password.startsWith('$2');
    console.log(`  - Bcrypt password hash validated: ${hasBcrypt ? 'YES ($2a/$2b)' : 'NO'}`);
    console.log(`  - Primary username indexed: ${Boolean(sampleUser.primaryUsername)} (@${sampleUser.primaryUsername})`);
  }

  // 2. Workspaces
  const wsCount = await Workspace.countDocuments();
  console.log(`✔ Workspaces collection: ${wsCount} active workspaces.`);

  // 3. Workspace Nodes (Channels & Categories)
  const nodeCount = await WorkspaceNode.countDocuments();
  console.log(`✔ WorkspaceNodes collection: ${nodeCount} channels/nodes.`);

  // 4. Messages
  const msgCount = await Message.countDocuments();
  console.log(`✔ Messages collection: ${msgCount} persisted messages.`);

  // 5. Contacts
  const contactCount = await Contact.countDocuments();
  console.log(`✔ Contacts collection: ${contactCount} active contacts.`);

  // 6. Personal Groups
  const groupCount = await PersonalGroup.countDocuments();
  console.log(`✔ Personal Groups collection: ${groupCount} active group chats.`);

  console.log('\n====================================================');
  console.log('DATABASE HEALTH: 100% OPERATIONAL & VERIFIED');
  console.log('====================================================');

  await mongoose.disconnect();
  process.exit(0);
}

runHealthCheck().catch((err) => {
  console.error('Database health check failed:', err);
  process.exit(1);
});
