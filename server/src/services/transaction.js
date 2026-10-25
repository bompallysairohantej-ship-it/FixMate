import mongoose from 'mongoose';
// Retry the complete callback with fresh reads after a transient transaction conflict.
// Native sessions avoid resetting tracked embedded documents between retry attempts.
export const transaction = (work) =>
  mongoose.connection
    .getClient()
    .withSession((session) => session.withTransaction(() => work(session)));
