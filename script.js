/**
 * Nepal Payroll Calculator
 * FY 2083/84 (2026/27) rules
 * - SSF: Employee 11% + Employer 20% of Basic
 * - PF: Employee 10% + Employer 10% of Basic
 * - Tax slabs (unified): 0-10L 1% (0% if SSF), 10-15L 10%, 15-25L 20%, 25-40L 27%, >40L 29%
 * - Retirement deduction: min(actual, 500000, 1/3 assessable)
 */

const formatNPR = (num) => {
  if (isNaN(num) || num === null) return '—';
  return new Intl.NumberFormat('en-NP', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0
  }).format(Math.round(num));
};

const TAX_SLABS = [
  { limit: 1000000, rate: 0.01, label: 'Up to 10,00,000' },
  { limit: 1500000, rate: 0.10, label: '10,00,001 – 15,00,000' },
  { limit: 2500000, rate: 0.20, label: '15,00,001 – 25,00,000' },
  { limit: 4000000, rate: 0.27, label: '25,00,001 – 40,00,000' },
  { limit: Infinity, rate: 0.29, label: 'Above 40,00,000' }
];

function calculateTax(taxableIncome, isSSF) {
  let remaining = taxableIncome;
  let previousLimit = 0;
  let totalTax = 0;
  const slabBreakdown = [];

  for (const slab of TAX_SLABS) {
    if (remaining <= 0) break;

    const slabWidth = slab.limit - previousLimit;
    const amountInSlab = Math.min(remaining, slabWidth);
    let rate = slab.rate;

    // First slab SST waiver for SSF members
    if (previousLimit === 0 && isSSF) {
      rate = 0;
    }

    const taxInSlab = amountInSlab * rate;
    totalTax += taxInSlab;

    if (amountInSlab > 0) {
      slabBreakdown.push({
        label: slab.label,
        amount: amountInSlab,
        rate: rate * 100,
        tax: taxInSlab
      });
    }

    remaining -= amountInSlab;
    previousLimit = slab.limit;
  }

  return { totalTax, slabBreakdown };
}

function calculatePayroll() {
  // --- Inputs ---
  const basic = parseFloat(document.getElementById('basicSalary').value) || 0;
  const allowances = parseFloat(document.getElementById('allowances').value) || 0;
  const scheme = document.getElementById('scheme').value;
  const ssfCeiling = parseFloat(document.getElementById('ssfCeiling').value) || 350000;

  const includeFestival = document.getElementById('includeFestival').checked;
  const festival = includeFestival ? (parseFloat(document.getElementById('festivalAllowance').value) || 0) : 0;

  const includeBonus = document.getElementById('includeBonus').checked;
  const bonus = includeBonus ? (parseFloat(document.getElementById('bonus').value) || 0) : 0;

  const includeAdd = document.getElementById('includeAddAllowance').checked;
  const addAllowance = includeAdd ? (parseFloat(document.getElementById('addAllowance').value) || 0) : 0;

  const otherDed = parseFloat(document.getElementById('otherDeductions').value) || 0;

  // --- Basic monthly calculations ---
  const grossMonthly = basic + allowances;
  const contributableBasic = Math.min(basic, ssfCeiling); // ceiling applies

  let eeRate, erRate;
  if (scheme === 'ssf') {
    eeRate = 0.11;
    erRate = 0.20;
  } else {
    eeRate = 0.10;
    erRate = 0.10;
  }

  const eeContribMonthly = contributableBasic * eeRate;
  const erContribMonthly = contributableBasic * erRate;

  // Annual figures
  const basicAnnual = basic * 12;
  const allowAnnual = allowances * 12;
  const grossAnnualBase = (basic + allowances) * 12;
  const additionalBenefits = festival + bonus + addAllowance;
  const grossAnnual = grossAnnualBase + additionalBenefits;

  const eeContribAnnual = eeContribMonthly * 12;
  const erContribAnnual = erContribMonthly * 12;

  // Assessable income = Gross (cash) salary. Employer contrib is NOT added to employee's income.
  const assessableIncome = grossAnnual;

  // Retirement deduction = min(actual total contrib, 500000, 1/3 of assessable)
  const totalRetirementContrib = eeContribAnnual + erContribAnnual;
  const oneThird = assessableIncome / 3;
  const retirementDeduction = Math.min(totalRetirementContrib, 500000, oneThird);

  const taxableIncome = Math.max(0, assessableIncome - retirementDeduction);

  const isSSF = scheme === 'ssf';
  const { totalTax, slabBreakdown } = calculateTax(taxableIncome, isSSF);

  // Monthly TDS approximation (annual tax / 12)
  // Note: In practice employers often annualize expected income.
  const monthlyTax = totalTax / 12;

  // For display: separate SST vs Income Tax (first slab is SST conceptually)
  let sstAnnual = 0;
  let incomeTaxAnnual = totalTax;
  if (!isSSF && taxableIncome > 0) {
    const firstSlabAmount = Math.min(taxableIncome, 1000000);
    sstAnnual = firstSlabAmount * 0.01;
    incomeTaxAnnual = totalTax - sstAnnual;
  }

  // Net Pay
  const netMonthly = grossMonthly - eeContribMonthly - monthlyTax - otherDed;
  const netAnnual = netMonthly * 12; // approximate (festival/bonus paid separately in reality)

  // CTC = Gross + Employer contributions (+ other employer costs if any)
  // Note: Festival/bonus paid by employer are already in grossAnnual
  const ctcAnnual = grossAnnual + erContribAnnual;
  const ctcMonthly = ctcAnnual / 12;

  // --- Update UI ---
  document.getElementById('netPay').textContent = 'NPR ' + formatNPR(netMonthly);
  document.getElementById('grossMonthly').textContent = 'NPR ' + formatNPR(grossMonthly);
  document.getElementById('ctcAnnual').textContent = 'NPR ' + formatNPR(ctcAnnual);
  document.getElementById('monthlyTax').textContent = 'NPR ' + formatNPR(monthlyTax);

  // Table
  document.getElementById('basicM').textContent = formatNPR(basic);
  document.getElementById('basicA').textContent = formatNPR(basicAnnual);
  document.getElementById('allowM').textContent = formatNPR(allowances);
  document.getElementById('allowA').textContent = formatNPR(allowAnnual);

  // Festival shown as annual mainly
  document.getElementById('festM').textContent = festival > 0 ? formatNPR(festival / 12) + ' (avg)' : '—';
  document.getElementById('festA').textContent = formatNPR(festival);

  const otherBenefits = bonus + addAllowance;
  document.getElementById('bonusM').textContent = otherBenefits > 0 ? formatNPR(otherBenefits / 12) + ' (avg)' : '—';
  document.getElementById('bonusA').textContent = formatNPR(otherBenefits);

  document.getElementById('grossM').textContent = formatNPR(grossMonthly);
  document.getElementById('grossA').textContent = formatNPR(grossAnnual);

  document.getElementById('empContribM').textContent = formatNPR(erContribMonthly);
  document.getElementById('empContribA').textContent = formatNPR(erContribAnnual);

  document.getElementById('ctcM').textContent = formatNPR(ctcMonthly);
  document.getElementById('ctcA').textContent = formatNPR(ctcAnnual);

  document.getElementById('eeContribM').textContent = formatNPR(eeContribMonthly);
  document.getElementById('eeContribA').textContent = formatNPR(eeContribAnnual);

  document.getElementById('sstM').textContent = formatNPR(sstAnnual / 12);
  document.getElementById('sstA').textContent = formatNPR(sstAnnual);

  document.getElementById('taxM').textContent = formatNPR(incomeTaxAnnual / 12);
  document.getElementById('taxA').textContent = formatNPR(incomeTaxAnnual);

  document.getElementById('otherM').textContent = formatNPR(otherDed);
  document.getElementById('otherA').textContent = formatNPR(otherDed * 12);

  document.getElementById('netM').textContent = formatNPR(netMonthly);
  document.getElementById('netA').textContent = formatNPR(netAnnual);

  // Tax details
  document.getElementById('assessable').textContent = 'NPR ' + formatNPR(assessableIncome);
  document.getElementById('retDeduction').textContent = 'NPR ' + formatNPR(retirementDeduction);
  document.getElementById('taxableIncome').textContent = 'NPR ' + formatNPR(taxableIncome);
  document.getElementById('ssfWaiver').textContent = isSSF ? 'Yes (0% on first slab)' : 'No (1% SST applies)';

  const slabList = document.getElementById('slabDetails');
  slabList.innerHTML = '';
  slabBreakdown.forEach(s => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${s.label} @ ${s.rate}%</span><span>NPR ${formatNPR(s.tax)}</span>`;
    slabList.appendChild(li);
  });
  document.getElementById('totalTax').textContent = 'NPR ' + formatNPR(totalTax);
}

function resetForm() {
  document.getElementById('basicSalary').value = 50000;
  document.getElementById('allowances').value = 15000;
  document.getElementById('scheme').value = 'ssf';
  document.getElementById('ssfCeiling').value = 350000;
  document.getElementById('includeFestival').checked = true;
  document.getElementById('festivalAllowance').value = 50000;
  document.getElementById('includeBonus').checked = false;
  document.getElementById('bonus').value = 0;
  document.getElementById('includeAddAllowance').checked = false;
  document.getElementById('addAllowance').value = 0;
  document.getElementById('otherDeductions').value = 0;
  calculatePayroll();
}

// Event listeners
document.getElementById('calculateBtn').addEventListener('click', calculatePayroll);
document.getElementById('resetBtn').addEventListener('click', resetForm);

// Auto-calculate on input change
['basicSalary', 'allowances', 'scheme', 'ssfCeiling', 'festivalAllowance',
 'bonus', 'addAllowance', 'otherDeductions'].forEach(id => {
  document.getElementById(id).addEventListener('input', calculatePayroll);
  document.getElementById(id).addEventListener('change', calculatePayroll);
});

['includeFestival', 'includeBonus', 'includeAddAllowance'].forEach(id => {
  document.getElementById(id).addEventListener('change', calculatePayroll);
});

// Initial calculation
document.addEventListener('DOMContentLoaded', calculatePayroll);
