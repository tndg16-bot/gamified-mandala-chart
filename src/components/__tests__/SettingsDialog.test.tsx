import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsDialog } from '../SettingsDialog';
import '@testing-library/jest-dom';
import { AiConfig } from '@/lib/types';

// Mock shadcn/ui components that require Portal or context
jest.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open, onOpenChange }: any) => (
    <div data-testid="mock-dialog" className={open ? 'dialog-open' : 'dialog-closed'}>
      <button onClick={() => onOpenChange(!open)}>Toggle Dialog</button>
      {children}
    </div>
  ),
  DialogContent: ({ children }: any) => <div data-testid="mock-dialog-content">{children}</div>,
  DialogHeader: ({ children }: any) => <div data-testid="mock-dialog-header">{children}</div>,
  DialogTitle: ({ children }: any) => <h2 data-testid="mock-dialog-title">{children}</h2>,
  DialogDescription: ({ children }: any) => <p data-testid="mock-dialog-description">{children}</p>,
  DialogFooter: ({ children }: any) => <div data-testid="mock-dialog-footer">{children}</div>,
}));

jest.mock('@/components/ui/button', () => ({
  Button: ({ children, onClick, disabled, variant, className }: any) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant} className={className}>
      {children}
    </button>
  ),
}));

jest.mock('@/components/ui/input', () => ({
  Input: ({ id, value, onChange, placeholder, type = 'text' }: any) => (
    <input
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      type={type}
      data-testid={`input-${id}`}
    />
  ),
}));

jest.mock('@/components/ui/label', () => ({
  Label: ({ htmlFor, children }: any) => <label htmlFor={htmlFor}>{children}</label>,
}));

// Mock Select component
jest.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, children, ...props }: any) => (
    <select
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      data-testid={props['data-testid'] || 'select-ai-provider'}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children, id }: any) => (
    <div data-testid={`select-trigger-${id}`}>{children}</div>
  ),
  SelectValue: ({ placeholder }: any) => <span data-testid="select-value">{placeholder}</span>,
  SelectContent: ({ children }: any) => (
    // Only render children, as actual Radix UI content is in a Portal
    <>{children}</>
  ),
  SelectItem: ({ value, children }: any) => (
    <option value={value}>{children}</option>
  ),
}));


describe('SettingsDialog', () => {
  const defaultObsidianPath = 'old/path';
  const defaultAutoSync = false;
  const defaultAiConfig: AiConfig = {
    provider: 'ollama',
    baseUrl: 'http://localhost:11434',
    model: 'llama3',
  };
  const defaultNotifications = {
    enabled: false,
    time: '09:00',
    frequency: 'daily',
    weeklyDay: 1,
    emailEnabled: false,
    pushEnabled: false,
  };

  const mockOnSave = jest.fn();
  const mockOnOpenChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with initial values', () => {
    render(
      <SettingsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        obsidianPath={defaultObsidianPath}
        autoSync={defaultAutoSync}
        aiConfig={defaultAiConfig}
        notificationConfig={defaultNotifications}
        onSave={mockOnSave}
      />
    );

    expect(screen.getByTestId('mock-dialog')).toHaveClass('dialog-open');
    expect(screen.getByTestId('mock-dialog-title')).toHaveTextContent('Settings');
    expect(screen.getByTestId('input-obsidian-path')).toHaveValue(defaultObsidianPath);
    expect(screen.getByTestId('input-auto-sync')).not.toBeChecked();
    expect(screen.getByTestId('select-ai-provider')).toHaveValue('ollama');
    expect(screen.getByTestId('input-ai-baseUrl')).toHaveValue(defaultAiConfig.baseUrl);
    expect(screen.getByTestId('input-ai-model')).toHaveValue(defaultAiConfig.model);
    expect(screen.queryByTestId('input-ai-apiKey')).not.toBeInTheDocument();
  });

  it('updates local path and auto sync state on change', () => {
    render(
      <SettingsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        obsidianPath={defaultObsidianPath}
        autoSync={defaultAutoSync}
        aiConfig={defaultAiConfig}
        notificationConfig={defaultNotifications}
        onSave={mockOnSave}
      />
    );

    const pathInput = screen.getByTestId('input-obsidian-path');
    fireEvent.change(pathInput, { target: { value: '/new/path' } });
    expect(pathInput).toHaveValue('/new/path');

    const autoSyncCheckbox = screen.getByTestId('input-auto-sync');
    fireEvent.click(autoSyncCheckbox);
    expect(autoSyncCheckbox).toBeChecked();
  });

  it('updates AI config state on change', () => {
    render(
      <SettingsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        obsidianPath={defaultObsidianPath}
        autoSync={defaultAutoSync}
        aiConfig={defaultAiConfig}
        notificationConfig={defaultNotifications}
        onSave={mockOnSave}
      />
    );

    const baseUrlInput = screen.getByTestId('input-ai-baseUrl');
    fireEvent.change(baseUrlInput, { target: { value: 'http://new-url' } });
    expect(baseUrlInput).toHaveValue('http://new-url');

    const modelInput = screen.getByTestId('input-ai-model');
    fireEvent.change(modelInput, { target: { value: 'new-model' } });
    expect(modelInput).toHaveValue('new-model');
  });

  it('shows API Key input for Gemini provider', () => {
    const geminiConfig: AiConfig = { ...defaultAiConfig, provider: 'gemini', apiKey: 'abc-123' };
    render(
      <SettingsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        obsidianPath={defaultObsidianPath}
        autoSync={defaultAutoSync}
        aiConfig={geminiConfig}
        notificationConfig={defaultNotifications}
        onSave={mockOnSave}
      />
    );

    const providerSelect = screen.getByTestId('select-ai-provider');
    fireEvent.change(providerSelect, { target: { value: 'gemini' } });

    expect(screen.getByTestId('input-ai-apiKey')).toHaveValue(geminiConfig.apiKey);
  });

  it('calls onSave with correct values when Save Changes button is clicked', async () => {
    render(
      <SettingsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        obsidianPath={defaultObsidianPath}
        autoSync={defaultAutoSync}
        aiConfig={defaultAiConfig}
        notificationConfig={defaultNotifications}
        onSave={mockOnSave}
      />
    );

    // Change some values
    fireEvent.change(screen.getByTestId('input-obsidian-path'), { target: { value: '/test/path' } });
    fireEvent.click(screen.getByTestId('input-auto-sync'));
    fireEvent.change(screen.getByTestId('input-ai-baseUrl'), { target: { value: 'http://test-ai-url' } });
    fireEvent.change(screen.getByTestId('input-ai-model'), { target: { value: 'test-ai-model' } });
    fireEvent.change(screen.getByTestId('select-ai-provider'), { target: { value: 'gemini' } });
    fireEvent.change(screen.getByTestId('input-ai-apiKey'), { target: { value: 'test-api-key' } });


    fireEvent.click(screen.getByText('Save Changes'));

    await waitFor(() => {
      expect(mockOnSave).toHaveBeenCalledTimes(1);
      expect(mockOnSave).toHaveBeenCalledWith(
        '/test/path',
        true,
        {
          provider: 'gemini',
          baseUrl: 'http://test-ai-url',
          model: 'test-ai-model',
          apiKey: 'test-api-key',
        },
        defaultNotifications
      );
    });

    expect(mockOnOpenChange).toHaveBeenCalledWith(false); // Dialog should close on save
  });

  it('calls onOpenChange with false when Cancel button is clicked', () => {
    render(
      <SettingsDialog
        open={true}
        onOpenChange={mockOnOpenChange}
        obsidianPath={defaultObsidianPath}
        autoSync={defaultAutoSync}
        aiConfig={defaultAiConfig}
        notificationConfig={defaultNotifications}
        onSave={mockOnSave}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    expect(mockOnSave).not.toHaveBeenCalled();
  });
});
