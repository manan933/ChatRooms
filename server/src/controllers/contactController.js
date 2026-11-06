import storageService from '../services/storageService.js';

// @desc    Get personal contacts and groups for current user
// @route   GET /api/contacts
// @access  Public / Private
export const getContactsAndGroups = async (req, res, next) => {
  try {
    const userId = req.user ? (req.user._id || req.user.id) : 'user-1';
    const username = req.user ? (req.user.primaryUsername || req.user.username) : 'soumya';

    const data = await storageService.getUserConversations(userId, username);

    return res.status(200).json({
      success: true,
      contacts: data.contacts,
      groups: data.groups,
    });
  } catch (error) {
    console.error('[Contacts] Error in getContactsAndGroups:', error);
    next(error);
  }
};

// @desc    Search registered users by username or name to add as contacts
// @route   GET /api/contacts/search
// @access  Public / Private
export const searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user?._id || req.user?.id;

    const users = await storageService.searchUsers(q, currentUserId);
    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    console.error('[Search] Error in searchUsers:', error);
    next(error);
  }
};

// @desc    Add a new personal contact
// @route   POST /api/contacts
// @access  Public / Private
export const createContact = async (req, res, next) => {
  try {
    const { name, username, contactUsername, bio, avatar } = req.body || {};
    const targetUsername = username || contactUsername;

    if (!targetUsername?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Username is required to add a contact',
      });
    }

    const currentUserId = req.user?._id || req.user?.id || 'user-1';
    const currentUsername = req.user?.primaryUsername || req.user?.username || 'user';

    const contact = await storageService.addContact(currentUserId, currentUsername, targetUsername, name, bio, avatar);
    if (!contact) {
      return res.status(400).json({
        success: false,
        message: `Failed to add contact @${targetUsername}`,
      });
    }

    return res.status(201).json({
      success: true,
      data: contact,
    });
  } catch (error) {
    console.error('[CreateContact] Error in createContact:', error);
    next(error);
  }
};

// @desc    Create a new personal group
// @route   POST /api/contacts/groups
// @access  Private
export const createPersonalGroup = async (req, res, next) => {
  try {
    const { name, description } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required',
      });
    }

    const currentUserId = req.user?._id || req.user?.id;
    const group = await storageService.createGroup(name.trim(), description?.trim() || '', currentUserId);

    return res.status(201).json({
      success: true,
      data: group,
    });
  } catch (error) {
    console.error('[CreateGroup] Error in createPersonalGroup:', error);
    next(error);
  }
};
