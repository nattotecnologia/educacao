function testDateLogic(aiInput) {
  let dateRaw = aiInput;
  
  // Preprocessor Step:
  if (dateRaw.includes('T') && !dateRaw.endsWith('Z') && !dateRaw.match(/[-+]\d{2}:?\d{2}$/)) {
    dateRaw = dateRaw.substring(0, 19) + '-03:00';
  }
  
  const dateObj = new Date(dateRaw);
  const preprocessedIso = dateObj.toISOString();
  console.log('Raw input:', aiInput);
  console.log('After preprocessor regex:', dateRaw);
  console.log('After preprocessor ISO:', preprocessedIso);

  // inside register_visit:
  const localTimeString = preprocessedIso.substring(0, 19);
  console.log('localTimeString derived:', localTimeString);
  
  const schedTime = new Date(localTimeString + 'Z').getTime();
  const dbStorage = localTimeString + 'Z';
  console.log('Written to DB:', dbStorage);

  // Final formatting:
  const realDateObj = new Date(schedTime);
  const dateFormatted = realDateObj.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  console.log('Human Formatted Output:', dateFormatted);
}

console.log('--- Test 1: AI sends naked 15:00 ---');
testDateLogic('2026-05-11T15:00:00');

console.log('\n--- Test 2: AI sends 15:00 with offset ---');
testDateLogic('2026-05-11T15:00:00-03:00');

console.log('\n--- Test 3: AI is clever and sends 18:00Z ---');
testDateLogic('2026-05-11T18:00:00Z');
