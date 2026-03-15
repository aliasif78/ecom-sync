const ErrorMessage = ({ message }: { message: string }) => {
  return (
    <div className="flex h-full w-full items-center justify-center pt-10 text-center">
      <p className="w-full rounded-lg border border-red-900/50 bg-red-900/10 p-10 text-red-400">{message}</p>
    </div>
  );
};

export default ErrorMessage;
