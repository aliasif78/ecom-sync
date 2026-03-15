const ErrorMessage = ({ message }: { message: string }) => {
  return (
    <div className="flex h-screen w-screen items-center justify-center text-center">
      <p className="rounded-lg border border-red-900/50 bg-red-900/10 p-10 text-red-400">{message}</p>
    </div>
  );
};

export default ErrorMessage;
