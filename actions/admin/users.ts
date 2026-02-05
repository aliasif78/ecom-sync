'use server';

// Next Js
import { revalidatePath } from 'next/cache';

// BE functions
import { updateUserById, deleteUserById } from '@/lib/users';

export const updateUser = async (id: string, name: string, role: string, status: string) => {
  const { success, message } = await updateUserById(id, { name, role, status });
  if (success) revalidatePath('/admin/users');
  return { success, message };
};

export const deleteUser = async (id: string) => {
  const { success, message } = await deleteUserById(id);
  if (success) revalidatePath('/admin/users');
  return { success, message };
};
