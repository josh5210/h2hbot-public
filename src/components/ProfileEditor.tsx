// /src/components/ProfileEditor.tsx
import React, { useState } from 'react';
import { z } from 'zod';

// Validation schema for name
const nameSchema = z
  .string()
  .min(1, "Name must be at least 1 character long")
  .max(20, "Name cannot exceed 20 characters")
  // Disallow special characters and numbers, allow spaces and hyphens
  .regex(
    /^[a-zA-Z\s-]+$/,
    "Name can only contain letters, spaces, and hyphens"
  )
  .transform(str => {
    // Trim extra spaces and normalize to single spaces
    return str.replace(/\s+/g, ' ').trim();
  });

interface ProfileEditorProps {
  initialName: string;
  onSave: (newName: string) => Promise<void>;
  onCancel: () => void;
}

const ProfileEditor = ({ initialName, onSave, onCancel }: ProfileEditorProps) => {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // Validate name
      const validatedName = nameSchema.parse(name);
      setIsSaving(true);

      // Call save handler
      await onSave(validatedName);
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(err.errors[0].message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-900">
          Display Name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
          disabled={isSaving}
        />
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
        >
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
};

export default ProfileEditor;