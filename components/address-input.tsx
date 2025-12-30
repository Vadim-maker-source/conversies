import { AddressSuggestions, DaDataAddress, DaDataSuggestion } from "react-dadata";

interface Props {
  value?: DaDataSuggestion<DaDataAddress> | null;
  onChange?: (value: DaDataSuggestion<DaDataAddress> | null) => void;
  placeholder?: string;
  className?: string;
  allowInternational?: boolean;
}

export const AddressInput: React.FC<Props> = ({ 
  value, 
  onChange, 
  placeholder = "Введите адрес"
}) => {
  return (
    <div className="w-full">
      <AddressSuggestions
        token={process.env.NEXT_PUBLIC_DADATA_API_KEY || ""}
        value={value || undefined}
        onChange={(suggestion) => onChange?.(suggestion || null)}
        inputProps={{
          placeholder,
          className: "w-full p-3 bg-gray-800 text-white rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-purple-500",
        }}
        // Основные стили для вертикального списка
        suggestionsClassName="react-dadata__suggestions !w-full !max-h-80 !overflow-y-auto !bg-gray-800 !border !border-gray-600 !rounded-lg !shadow-lg !mt-1"
        suggestionClassName="react-dadata__suggestion !block !p-3 !text-white hover:!bg-gray-700 !cursor-pointer last:!border-b-0 !w-full !flex !items-start !justify-start"
        highlightClassName="react-dadata__highlight !bg-purple-500 !text-white"
        minChars={1}
        delay={300}
        count={8}
        filterLocations={[{ country: "*" }]}
        renderOption={(suggestion: DaDataSuggestion<DaDataAddress>) => (
          <div className="space-y-1">
            <div className="font-medium text-white">
              {suggestion.value}
            </div>
          </div>
        )}
      />
    </div>
  );
};