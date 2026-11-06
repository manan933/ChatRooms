import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import WorkspaceNode from '../models/WorkspaceNode.js';
import Message from '../models/Message.js';
import { Contact, PersonalGroup } from '../models/Contact.js';
import {
  defaultUser,
  defaultContacts,
  defaultPersonalGroups,
  defaultWorkspaces,
  defaultWorkspaceNodes,
  defaultMessages,
} from '../utils/seedData.js';

export const seedDatabase = async () => {
  try {
    console.log('[Seeder] Connecting to MongoDB Atlas...');
    await connectDB();

    console.log('[Seeder] Clearing old collections...');
    await User.deleteMany({});
    await Workspace.deleteMany({});
    await WorkspaceNode.deleteMany({});
    await Message.deleteMany({});
    await Contact.deleteMany({});
    await PersonalGroup.deleteMany({});

    console.log('[Seeder] Creating Primary User...');
    const user = await User.create(defaultUser);
    console.log(`[Seeder] User created: ${user.name} (@${user.primaryUsername})`);

    console.log('[Seeder] Inserting Workspaces...');
    const workspacesWithUser = defaultWorkspaces.map((w) => ({
      ...w,
      owner: user._id,
    }));
    await Workspace.insertMany(workspacesWithUser);

    console.log('[Seeder] Inserting Workspace Nodes...');
    await WorkspaceNode.insertMany(defaultWorkspaceNodes);

    console.log('[Seeder] Inserting Personal Contacts & Groups...');
    await Contact.insertMany(defaultContacts);
    await PersonalGroup.insertMany(defaultPersonalGroups);

    console.log('[Seeder] Inserting Messages...');
    await Message.insertMany(defaultMessages);

    console.log('✅ [Seeder] Database seeded successfully into MongoDB Atlas!');
    return { success: true, message: 'Seeded successfully' };
  } catch (error) {
    console.error('❌ [Seeder] Error during seeding:', error);
    throw error;
  }
};

// If run directly from command line
seedDatabase()
  .then(() => {
    console.log('[Seeder] Process complete. Exiting...');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Seeder] Fatal error:', err);
    process.exit(1);
  });
