const Divider = ({ title }: { title: string }) => {
  return (
    <div className="relative my-1">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-slate-800"></div>
      </div>

      <div className="relative flex justify-center">
        <span className="bg-slate-900 px-2 text-xs font-medium tracking-widest text-slate-500 uppercase">{title}</span>
      </div>
    </div>
  );
};

export default Divider;
