export const maskPhone = (value: string) => {
  if (!value) return "";
  
  // Remove tudo que não é número
  let digits = value.replace(/\D/g, "");
  
  // Se começar com 55 e tiver pelo menos 11 dígitos, tratamos como internacional Brasil
  if (digits.startsWith("55") && digits.length >= 11) {
    const country = digits.slice(0, 2);
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    
    if (digits.length <= 4) {
      return `+${country} (${ddd}`;
    }
    return `+${country} (${ddd}) ${rest}`;
  }

  // Comportamento padrão para números locais (aumentado para evitar truncamento prematuro)
  const clearValue = digits.slice(0, 15);
  
  if (clearValue.length <= 2) {
    return clearValue.length > 0 ? `(${clearValue}` : "";
  }
  if (clearValue.length <= 6) {
    return `(${clearValue.slice(0, 2)}) ${clearValue.slice(2)}`;
  }
  if (clearValue.length <= 10) {
    // Formato para fixo: (99) 9999-9999
    return `(${clearValue.slice(0, 2)}) ${clearValue.slice(2, 6)}-${clearValue.slice(6)}`;
  }
  // Formato para celular: (99) 99999-9999
  return `(${clearValue.slice(0, 2)}) ${clearValue.slice(2, 7)}-${clearValue.slice(7)}`;
};
