import { inngest } from './client';

export const helloWorld = inngest.createFunction(
  { id: 'hello-world' }, // 1. The Function ID (Must be unique)
  { event: 'test/hello.world' }, // 2. The Event trigger
  async ({ event, step }) => {
    // 3. The Logic
    await step.sleep('wait-a-sec', '1s'); // Tells Inngest to wait 1s

    // 4. Return the result
    return { message: `Hello ${event.data.email}!`, timestamp: Date.now() };
  }
);
