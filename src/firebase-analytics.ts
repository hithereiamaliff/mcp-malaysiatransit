import admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

interface Analytics {
  serverStartTime: string;
  totalRequests: number;
  totalToolCalls: number;
  requestsByMethod: Record<string, number>;
  requestsByEndpoint: Record<string, number>;
  toolCalls: Record<string, number>;
  recentToolCalls: Array<{
    tool: string;
    timestamp: string;
    clientIp: string;
    userAgent: string;
  }>;
  clientsByIp: Record<string, number>;
  clientsByUserAgent: Record<string, number>;
  hourlyRequests: Record<string, number>;
}

class FirebaseAnalytics {
  private db!: admin.database.Database;
  private serverName: string;
  private initialized: boolean = false;

  constructor(serverName: string = 'mcp-malaysiatransit') {
    this.serverName = serverName;
    
    try {
      // Try to load service account from credentials directory
      const credentialPath = path.join(
        process.cwd(),
        '.credentials/firebase-service-account.json'
      );
      
      if (!fs.existsSync(credentialPath)) {
        console.warn('⚠️ Firebase credentials not found, analytics will be disabled');
        return;
      }

      const serviceAccount = JSON.parse(fs.readFileSync(credentialPath, 'utf-8'));

      // Initialize Firebase Admin if not already initialized
      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: `https://${serviceAccount.project_id}-default-rtdb.asia-southeast1.firebasedatabase.app`
        });
      }

      this.db = admin.database();
      this.initialized = true;
      console.log('🔥 Firebase Analytics initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Firebase Analytics:', error);
      this.initialized = false;
    }
  }

  async saveAnalytics(analytics: Analytics): Promise<void> {
    if (!this.initialized) return;

    try {
      const ref = this.db.ref(`mcp-analytics/${this.serverName}`);
      await ref.set({
        ...analytics,
        lastUpdated: admin.database.ServerValue.TIMESTAMP,
        _timestamp: new Date().toISOString()
      });
      console.log('💾 Analytics saved to Firebase');
    } catch (error) {
      console.error('❌ Failed to save analytics to Firebase:', error);
    }
  }

  async loadAnalytics(): Promise<Analytics | null> {
    if (!this.initialized) return null;

    try {
      const snapshot = await this.db.ref(`mcp-analytics/${this.serverName}`).once('value');
      const data = snapshot.val();
      
      if (data) {
        // Remove Firebase metadata fields
        const { lastUpdated, _timestamp, ...analytics } = data;
        console.log('📊 Loaded analytics from Firebase');
        console.log(`   Total requests: ${analytics.totalRequests}, Tool calls: ${analytics.totalToolCalls}`);
        return analytics as Analytics;
      }
      
      return null;
    } catch (error) {
      console.error('❌ Failed to load analytics from Firebase:', error);
      return null;
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }
}

export { FirebaseAnalytics, Analytics };