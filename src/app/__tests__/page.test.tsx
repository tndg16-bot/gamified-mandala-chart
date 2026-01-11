import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Home from '../page';
import '@testing-library/jest-dom';
import { useAuth } from '@/components/AuthContext'; // useAuth をインポート

jest.mock('@/components/AuthContext');
const mockUseAuth = useAuth as jest.Mock;

let mockSettingsValues = {
  obsidianPath: '/initial/obsidian/path',
  autoSync: false,
  aiConfig: { provider: 'gemini', baseUrl: 'https://gemini.api', model: 'gemini-pro', apiKey: 'initial-key' },
  notifications: { enabled: false, time: '09:00', frequency: 'daily', weeklyDay: 1, emailEnabled: false, pushEnabled: false },
  role: 'client',
};

jest.mock('@/components/SettingsDialog', () => ({
  SettingsDialog: ({ open, onOpenChange, onSave }: any) => (
    open ? (
      <div>
        <div>Settings</div>
        <button onClick={async () => {
          try {
            await onSave(
              mockSettingsValues.obsidianPath,
              mockSettingsValues.autoSync,
              mockSettingsValues.aiConfig,
              mockSettingsValues.notifications,
              mockSettingsValues.role
            );
          } catch (error) {
            console.error("Failed to save settings:", error);
            alert("Failed to save settings. Please try again.");
          }
        }}>Save Changes</button>
        <button onClick={() => onOpenChange(false)}>Cancel</button>
      </div>
    ) : null
  )
}));


require('whatwg-fetch'); // fetch polyfill

// Mock Firebase
jest.mock('@/lib/firebase', () => ({
  auth: {}, // Mock auth object
  db: {},   // Mock db object
  // Mock any other Firebase exports used
  getAuth: jest.fn(() => ({})),
  getFirestore: jest.fn(() => ({})),
  registerPushNotifications: jest.fn(() => Promise.resolve(null)),
}));

// Mock FirestoreService
const mockLoadUserData = jest.fn();
const mockUpdateObsidianConfig = jest.fn();
const mockUpdateAiConfig = jest.fn();
const mockUpdateNotificationConfig = jest.fn();
const mockUpdateUserRole = jest.fn();
const mockAddPushToken = jest.fn();
const mockGetLessonsForUser = jest.fn(() => Promise.resolve([]));
const mockGetPublicLessons = jest.fn(() => Promise.resolve([]));
const mockStartLesson = jest.fn();
const mockCompleteLesson = jest.fn();
const mockImportLessons = jest.fn();

jest.mock('@/lib/firestore_service', () => ({
  FirestoreService: {
    loadUserData: (...args: any[]) => mockLoadUserData(...args),
    updateObsidianConfig: (...args: any[]) => mockUpdateObsidianConfig(...args),
    updateAiConfig: (...args: any[]) => mockUpdateAiConfig(...args),
    updateNotificationConfig: (...args: any[]) => mockUpdateNotificationConfig(...args),
    updateUserRole: (...args: any[]) => mockUpdateUserRole(...args),
    addPushToken: (...args: any[]) => mockAddPushToken(...args),
    getLessonsForUser: (...args: any[]) => mockGetLessonsForUser(...args),
    getPublicLessons: (...args: any[]) => mockGetPublicLessons(...args),
    startLesson: (...args: any[]) => mockStartLesson(...args),
    completeLesson: (...args: any[]) => mockCompleteLesson(...args),
    importLessons: (...args: any[]) => mockImportLessons(...args),
    // Add other mocked methods as needed
  },
}));

// Mock aiClient (just the updateConfig and getConfig for this test)
const mockAiClientUpdateConfig = jest.fn();
const mockAiClientGetConfig = jest.fn();
jest.mock('@/lib/ai_client', () => ({
  aiClient: {
    updateConfig: (...args: any[]) => mockAiClientUpdateConfig(...args),
    getConfig: (...args: any[]) => mockAiClientGetConfig(...args),
    // Mock other methods if they are called directly within page.tsx
    chat: jest.fn(() => Promise.resolve('AI chat response')),
    generateActions: jest.fn(() => Promise.resolve(['Action 1', 'Action 2', 'Action 3'])),
  },
  DEFAULT_CONFIG: {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'gemma3:1b',
  },
}));

// Mock next/navigation for useRouter
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
  }),
}));

// Mock window.alert and console.error
const mockAlert = jest.fn();
const mockConsoleError = jest.fn();
global.alert = mockAlert;
global.console.error = mockConsoleError;
const localStorageGetItemSpy = jest.spyOn(Storage.prototype, 'getItem');
const localStorageSetItemSpy = jest.spyOn(Storage.prototype, 'setItem');

describe('Home Page - Settings Integration', () => {
  const initialAppData = {
    mandala: {
      centerSection: {
        id: "center",
        centerCell: { id: "core", title: "Core Goal", completed: false },
        surroundingCells: [],
      },
      surroundingSections: [],
    },
    tiger: { level: 1, xp: 0, mood: "Happy", lastLogin: "", streakDays: 0, evolutionStage: "Cub", pokedex: [] },
    xpHistory: [],
    notifications: { enabled: false, time: '09:00', frequency: 'daily', weeklyDay: 1, emailEnabled: false, pushEnabled: false },
    obsidian: { exportPath: '/initial/obsidian/path', autoSync: false },
    aiConfig: { provider: 'gemini', baseUrl: 'https://gemini.api', model: 'gemini-pro', apiKey: 'initial-key' },
    role: 'client',
  };

  beforeAll(() => { // beforeEach から beforeAll に変更
    // Reset mock for useAuth for each test
    mockUseAuth.mockReturnValue({
      user: { uid: 'test-uid', displayName: 'Test User' },
      loading: false,
      signInWithGoogle: jest.fn(),
      signInWithEmail: jest.fn(),
      signUpWithEmail: jest.fn(),
      logout: jest.fn(),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSettingsValues = {
      obsidianPath: '/initial/obsidian/path',
      autoSync: false,
      aiConfig: initialAppData.aiConfig,
      notifications: initialAppData.notifications,
      role: 'client',
    };
    mockLoadUserData.mockResolvedValue(initialAppData);
    mockAiClientGetConfig.mockReturnValue(initialAppData.aiConfig);
    localStorageGetItemSpy.mockReturnValue(null); // Clear localStorage for each test
    localStorageSetItemSpy.mockClear();
  });

  it('loads user data and applies AI config to aiClient on mount', async () => {
    // Mock localStorage to return no saved AI config initially
    (localStorage.getItem as jest.Mock).mockReturnValue(null);

    render(<Home />);

    await waitFor(() => expect(mockLoadUserData).toHaveBeenCalledWith({ uid: 'test-uid', displayName: 'Test User' }));
    await waitFor(() => expect(mockAiClientUpdateConfig).toHaveBeenCalledWith(initialAppData.aiConfig));
  });

  it('opens and closes the Settings Dialog', async () => {
    render(<Home />);
    await waitFor(() => expect(mockLoadUserData).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Loading Tiger...')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }));
    expect(screen.getByText('Settings')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cancel'));
    await waitFor(() => expect(screen.queryByText('Settings')).not.toBeInTheDocument());
  });

  it('saves settings including AI config and updates state', async () => {
    render(<Home />);
    await waitFor(() => expect(mockLoadUserData).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Loading Tiger...')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' })); // Open settings dialog

    const updatedAiConfig = { provider: 'ollama', baseUrl: 'http://new-ollama', model: 'new-ollama-model' };
    const updatedObsidianConfig = { exportPath: '/new/obsidian/path', autoSync: true };
    const updatedNotifications = { enabled: false, time: '09:00', frequency: 'daily', weeklyDay: 1, emailEnabled: false, pushEnabled: false };
    const updatedRole = 'coach';

    mockSettingsValues = {
      obsidianPath: updatedObsidianConfig.exportPath,
      autoSync: updatedObsidianConfig.autoSync,
      aiConfig: updatedAiConfig,
      notifications: updatedNotifications,
      role: updatedRole,
    };

    // Mock loadUserData to return data with updated config after save
    mockLoadUserData.mockResolvedValue({
      ...initialAppData,
      obsidian: updatedObsidianConfig,
      aiConfig: updatedAiConfig,
      notifications: updatedNotifications,
      role: updatedRole,
    });

    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockUpdateObsidianConfig).toHaveBeenCalledWith({ uid: 'test-uid', displayName: 'Test User' }, '/new/obsidian/path', true);
      expect(mockUpdateAiConfig).toHaveBeenCalledWith({ uid: 'test-uid', displayName: 'Test User' }, updatedAiConfig);
      expect(mockUpdateNotificationConfig).toHaveBeenCalledWith({ uid: 'test-uid', displayName: 'Test User' }, updatedNotifications);
      expect(mockUpdateUserRole).toHaveBeenCalledWith({ uid: 'test-uid', displayName: 'Test User' }, updatedRole);
      expect(mockAiClientUpdateConfig).toHaveBeenCalled();
      expect(mockLoadUserData.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(mockAlert).toHaveBeenCalled();
    });
  });

  it('handles save errors gracefully', async () => {
    mockUpdateAiConfig.mockRejectedValue(new Error('Failed to save AI config'));

    render(<Home />);
    await waitFor(() => expect(mockLoadUserData).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByText('Loading Tiger...')).not.toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' })); // Open settings dialog
    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockAlert).toHaveBeenCalledWith('Failed to save settings. Please try again.');
      expect(mockConsoleError).toHaveBeenCalledWith('Failed to save settings:', expect.any(Error));
    });
    // Dialog should remain open
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });
});
