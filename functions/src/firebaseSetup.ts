/**
 * Firebase Setup & Initialization
 * 
 * This file contains setup instructions for initializing Firestore with
 * required settings and indexes for the Cloud Functions to work properly
 */

import * as admin from 'firebase-admin';

/**
 * Initialize default settings in Firestore
 * 
 * Call this once to set up the system settings document
 * that Cloud Functions will read for alert thresholds
 */
export async function initializeFirestoreSettings() {
  const firestore = admin.firestore();

  try {
    const settingsRef = firestore.collection('settings').doc('system');
    const settingsDoc = await settingsRef.get();

    if (settingsDoc.exists) {
      console.log('Settings already initialized');
      return;
    }

    // Create default settings
    await settingsRef.set({
      alertThresholds: {
        nitrogen_min: 20, // mg/kg
        nitrogen_max: 50,
        phosphorus_min: 10, // mg/kg
        phosphorus_max: 40,
        potassium_min: 150, // mg/kg
        potassium_max: 250,
        deviceOfflineThreshold: 600000, // 10 minutes in ms
      },

      logRetention: 2592000000, // 30 days in ms
      alertRetention: 7776000000, // 90 days in ms
      commandRetention: 5184000000, // 60 days in ms

      features: {
        offlineAlerting: true,
        predictiveAnalysis: false,
        anomalyDetection: false,
        pushNotifications: true,
        emailNotifications: false,
      },

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log('Firestore settings initialized successfully');
  } catch (error) {
    console.error('Error initializing Firestore settings:', error);
    throw error;
  }
}

/**
 * Firestore Security Rules Required
 * 
 * Apply these rules in Firebase Console > Firestore > Rules
 */
export const firestoreRulesTemplate = `
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    
    // Settings - read-only for users
    match /settings/{document=**} {
      allow read: if request.auth != null;
      allow write: if false; // Admin only via console
    }
    
    // Fields and nested collections
    match /fields/{fieldId} {
      allow read: if request.auth.uid == resource.data.owner;
      allow create: if request.auth.uid == request.resource.data.owner;
      allow update: if request.auth.uid == resource.data.owner;
      allow delete: if request.auth.uid == resource.data.owner;
      
      // All nested documents inherit field permissions
      match /{document=**} {
        allow read: if request.auth.uid == get(/databases/$(database)/documents/fields/$(fieldId)).data.owner;
        allow write: if request.auth.uid == get(/databases/$(database)/documents/fields/$(fieldId)).data.owner;
      }
    }
    
    // Alerts - similar to fields but more complex rules
    match /alerts/{fieldId} {
      allow read: if request.auth.uid == get(/databases/$(database)/documents/fields/$(fieldId)).data.owner;
      
      match /alerts/{alertId} {
        allow read: if request.auth.uid == get(/databases/$(database)/documents/fields/$(fieldId)).data.owner;
        allow update: if request.auth.uid == get(/databases/$(database)/documents/fields/$(fieldId)).data.owner &&
                        (request.resource.data.read == true || request.resource.data.acknowledged == true);
        allow write: if false; // Cloud Functions only
      }
    }
    
    // Device audit logs
    match /devices/{deviceId} {
      allow read: if request.auth != null; // Any authenticated user can read device status
      allow write: if false; // Cloud Functions only
    }
    
    // Command audit trail
    match /command_audit/{commandId} {
      allow read: if request.auth.uid == resource.data.userId || 
                     request.auth != null; // Allow any user to view commands (consider restricting)
      allow write: if false; // Cloud Functions only
    }
    
    // User activity log
    match /user_activity/{userId} {
      allow read: if request.auth.uid == userId;
      allow write: if false; // Cloud Functions only
    }
  }
}
`;

/**
 * Required Firestore Indexes
 * 
 * Create these composite indexes in Firebase Console > Firestore > Indexes
 */
export const requiredIndexes = [
  {
    collection: 'fields/{fieldId}/paddies/{paddyId}/logs',
    fields: [
      { fieldPath: 'timestamp', order: 'DESCENDING' },
      { fieldPath: 'deviceId', order: 'ASCENDING' },
    ],
  },
  {
    collection: 'alerts',
    fields: [
      { fieldPath: 'createdAt', order: 'DESCENDING' },
      { fieldPath: 'severity', order: 'ASCENDING' },
    ],
  },
  {
    collection: 'command_audit',
    fields: [
      { fieldPath: 'deviceId', order: 'ASCENDING' },
      { fieldPath: 'requestedAt', order: 'DESCENDING' },
    ],
  },
];

/**
 * Firestore Indexes Config File
 * 
 * Save this to firestore.indexes.json in your project root
 */
export const firestoreIndexesJSON = {
  indexes: [
    {
      collectionGroup: 'logs',
      queryScope: 'COLLECTION',
      fields: [
        {
          fieldPath: 'timestamp',
          order: 'DESCENDING',
        },
        {
          fieldPath: 'deviceId',
          order: 'ASCENDING',
        },
      ],
    },
    {
      collectionGroup: 'paddies',
      queryScope: 'COLLECTION',
      fields: [
        {
          fieldPath: 'deviceId',
          order: 'ASCENDING',
        },
        {
          fieldPath: 'createdAt',
          order: 'DESCENDING',
        },
      ],
    },
    {
      collectionGroup: 'alerts',
      queryScope: 'COLLECTION',
      fields: [
        {
          fieldPath: 'createdAt',
          order: 'DESCENDING',
        },
        {
          fieldPath: 'severity',
          order: 'ASCENDING',
        },
      ],
    },
    {
      collectionGroup: 'command_audit',
      queryScope: 'COLLECTION',
      fields: [
        {
          fieldPath: 'deviceId',
          order: 'ASCENDING',
        },
        {
          fieldPath: 'requestedAt',
          order: 'DESCENDING',
        },
      ],
    },
  ],
  fieldOverrides: [],
};
