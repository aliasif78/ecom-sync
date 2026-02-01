'use server';

// Next Js
import { revalidatePath } from 'next/cache';

// BE functions
import { updateUserById, deleteUserById } from '@/lib/users';

export const updateUser = async (id: string, name: string, role: string) => {
  const { success, user, message } = await updateUserById(id, { name, role });
  if (success) revalidatePath('/admin/users');
  return { success, user, message };
};

export const deleteUser = async (id: string) => {
  const { success, user, message } = await deleteUserById(id);
  if (success) revalidatePath('/admin/users');
  return { success, user, message };
};
