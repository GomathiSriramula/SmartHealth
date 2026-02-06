import React from "react";

interface RiskIndicatorProps {
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | string;
  confidence?: number;
  size?: "small" | "medium" | "large";
  showLabel?: boolean;
}

const RiskIndicator: React.FC<RiskIndicatorProps> = ({
  riskLevel,
  confidence = 0,
  size = "medium",
  showLabel = true,
}) => {
  const normalizedRisk = (riskLevel || "LOW").toUpperCase();

  const getRiskStyles = () => {
    switch (normalizedRisk) {
      case "HIGH":
        return {
          bg: "bg-red-100",
          border: "border-red-300",
          text: "text-red-800",
          dot: "bg-red-500",
          glow: "shadow-lg shadow-red-200",
          icon: "🚨",
        };
      case "MEDIUM":
        return {
          bg: "bg-yellow-100",
          border: "border-yellow-300",
          text: "text-yellow-800",
          dot: "bg-yellow-500",
          glow: "shadow-lg shadow-yellow-200",
          icon: "⚠️",
        };
      case "LOW":
        return {
          bg: "bg-green-100",
          border: "border-green-300",
          text: "text-green-800",
          dot: "bg-green-500",
          glow: "shadow-md shadow-green-200",
          icon: "✅",
        };
      default:
        return {
          bg: "bg-gray-100",
          border: "border-gray-300",
          text: "text-gray-800",
          dot: "bg-gray-500",
          glow: "shadow-md shadow-gray-200",
          icon: "ℹ️",
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case "small":
        return "px-2 py-1 text-xs";
      case "large":
        return "px-4 py-3 text-lg";
      default:
        return "px-3 py-2 text-sm";
    }
  };

  const styles = getRiskStyles();
  const sizeClass = getSizeStyles();

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-lg border ${styles.bg} ${styles.border} ${styles.text} ${sizeClass} font-semibold ${styles.glow} transition-all`}
    >
      <span className="text-lg">{styles.icon}</span>
      {showLabel && (
        <div className="flex flex-col">
          <span>{normalizedRisk}</span>
          {confidence > 0 && <span className="text-xs opacity-75">{Math.round(confidence)}% confidence</span>}
        </div>
      )}
    </div>
  );
};

export default RiskIndicator;
