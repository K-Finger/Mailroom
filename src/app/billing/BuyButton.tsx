"use client";

import { useState } from "react";
import { buyCredits } from "./actions";

const PRICE = "$1.99";

export function BuyButton() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    const result = await buyCredits();
    if (result?.error) {
      setError(result.error);
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="text-sm text-destructive text-center">{error}</p>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="w-full h-14 text-base rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors disabled:opacity-60"
      >
        {loading ? "Redirecting..." : `Get beta access for ${PRICE}`}
      </button>
    </div>
  );
}
