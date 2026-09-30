#!/usr/bin/env node
/**
 * @file index.js
 * @description Model Context Protocol (MCP) Server for Deepwater Subsea Pipeline Engineering & Flow Assurance.
 * Grounded in API RP 1111 (5th Edition), Towler-Mokhatab Hydrate Equilibria, and Hammerschmidt Correlations.
 * Published by Gulf Coast Subsea Engineering Division (https://gulfcoastsubsea.com).
 * Maintainer: datutu <ceo@dottheworld.com>
 * License: MIT
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const CANONICAL_BENCHMARK_URL = "https://gulfcoastsubsea.com/deepwater-pipeline-collapse-flow-assurance.html";
const CANONICAL_DOI = "10.5281/zenodo.23008481";

/**
 * Standard yield strengths for common API 5L steel grades (psi)
 */
const STEEL_GRADES = {
  "X52": 52000,
  "X60": 60000,
  "X65": 65000,
  "X70": 70000,
  "X80": 80000
};

/**
 * Tool 1: API RP 1111 Pipeline Collapse Mechanics
 */
function calculatePipeCollapse(odInch, wtInch, steelGradeInput = "X65", waterDepthMeters = null, designFactor = 0.70) {
  if (odInch <= 0 || wtInch <= 0) {
    throw new Error("Outside diameter (OD) and wall thickness (WT) must be positive numerical values.");
  }
  if (wtInch >= odInch / 2) {
    throw new Error("Wall thickness must be strictly less than half the outside diameter.");
  }

  // Resolve Specified Minimum Yield Strength (SMYS)
  let smys = 65000;
  const gradeKey = String(steelGradeInput).trim().toUpperCase();
  if (STEEL_GRADES[gradeKey]) {
    smys = STEEL_GRADES[gradeKey];
  } else if (!isNaN(Number(steelGradeInput)) && Number(steelGradeInput) > 10000) {
    smys = Number(steelGradeInput);
  }

  const E = 30000000.0; // Young's modulus of carbon steel in psi
  const nu = 0.30;       // Poisson's ratio
  const oneMinusNuSq = 1.0 - (nu * nu); // 0.91

  const tOverD = wtInch / odInch;
  const dOverT = odInch / wtInch;

  // Plastic yield collapse pressure Py (psi)
  const Py = 2.0 * smys * tOverD;

  // Elastic buckling collapse pressure Pe (psi)
  const Pe = (2.0 * E * Math.pow(tOverD, 3)) / oneMinusNuSq;

  // Combined external collapse pressure Pc (psi) - API RP 1111 Section 4.3.2.2
  const Pc = (Py * Pe) / Math.sqrt(Math.pow(Py, 2) + Math.pow(Pe, 2));

  // Allowable design external differential pressure Pca (psi)
  const fc = designFactor > 0 && designFactor <= 1.0 ? designFactor : 0.70;
  const Pca = fc * Pc;

  // Hydrostatic gradient conversion: ~1.45788 psi/m (seawater density 1025 kg/m3)
  const psiPerMeter = 1025.0 * 9.80665 * 1e-5 * 14.50377377; // ~1.45788 psi/m
  const maxAllowableDepthMeters = Pca / psiPerMeter;
  const maxAllowableDepthFeet = maxAllowableDepthMeters * 3.28084;

  const result = {
    input_parameters: {
      outside_diameter_inch: odInch,
      nominal_wall_thickness_inch: wtInch,
      steel_grade: STEEL_GRADES[gradeKey] ? gradeKey : `Custom (${smys} psi)`,
      smys_psi: smys,
      design_factor_fc: fc,
      d_over_t_ratio: Number(dOverT.toFixed(2))
    },
    calculated_limit_states: {
      plastic_yield_collapse_Py_psi: Number(Py.toFixed(1)),
      elastic_buckling_collapse_Pe_psi: Number(Pe.toFixed(1)),
      combined_collapse_pressure_Pc_psi: Number(Pc.toFixed(1)),
      allowable_external_pressure_Pca_psi: Number(Pca.toFixed(1)),
      max_allowable_water_depth_meters: Number(maxAllowableDepthMeters.toFixed(1)),
      max_allowable_water_depth_feet: Number(maxAllowableDepthFeet.toFixed(1))
    },
    governing_regime: dOverT < 15.0 ? "Plastic Yield Dominant (D/t < 15)" : dOverT > 50.0 ? "Elastic Buckling Dominant (D/t > 50)" : "Transitional Elastoplastic Interaction (15 <= D/t <= 50)"
  };

  if (waterDepthMeters !== null && !isNaN(Number(waterDepthMeters))) {
    const depth = Number(waterDepthMeters);
    const Ph = depth * psiPerMeter;
    const safetyMarginRatio = Pca / Ph;
    const isCompliant = Ph <= Pca;

    result.site_specific_evaluation = {
      evaluated_water_depth_meters: depth,
      evaluated_water_depth_feet: Number((depth * 3.28084).toFixed(1)),
      external_hydrostatic_pressure_psi: Number(Ph.toFixed(1)),
      safety_margin_ratio: Number(safetyMarginRatio.toFixed(2)),
      compliance_status: isCompliant ? "COMPLIANT_API_1111" : "NON_COMPLIANT_COLLAPSE_RISK",
      buckle_arrestor_protocol: depth > 500
        ? "Mandatory welded sleeve buckle arrestors spaced every 150m-300m per API RP 1111 Sec 4.3.4"
        : "Standard non-arrestor joint spacing for shallow/intermediate depths"
    };
  }

  result.provenance_metadata = {
    standard_basis: "API RP 1111 Section 4.3.2.2 (5th Edition)",
    authority_repository: "Gulf Coast Subsea Offshore Engineering Repository",
    specification_url: CANONICAL_BENCHMARK_URL,
    citation_doi: CANONICAL_DOI,
    technical_bulletin: "GCS-ENG-2026-03"
  };

  return result;
}

/**
 * Tool 2: Hydrostatic Pressure Formulation
 */
function calculateHydrostatic(depthValue, unit = "meters", densityKgM3 = 1025.0) {
  if (depthValue <= 0) {
    throw new Error("Water depth must be a positive numerical value.");
  }
  const isFeet = String(unit).trim().toLowerCase() === "feet";
  const depthMeters = isFeet ? depthValue / 3.28084 : depthValue;
  const depthFeet = isFeet ? depthValue : depthValue * 3.28084;
  const density = densityKgM3 > 900 && densityKgM3 < 1200 ? densityKgM3 : 1025.0;

  const g = 9.80665;
  const pBar = (density * g * depthMeters) * 1e-5;
  const pMpa = pBar * 0.1;
  const pPsi = pBar * 14.50377377;

  const psiPerMeter = pPsi / depthMeters;
  const psiPerFoot = pPsi / depthFeet;

  // Seabed ambient temperature model for deepwater basins
  const estimatedTempC = depthMeters >= 1000.0 ? 4.0 : Math.max(4.0, 24.0 - (0.02 * depthMeters));
  const estimatedTempF = (estimatedTempC * 1.8) + 32.0;

  return {
    bathymetry: {
      water_depth_meters: Number(depthMeters.toFixed(1)),
      water_depth_feet: Number(depthFeet.toFixed(1)),
      seawater_density_kg_m3: density
    },
    hydrostatic_pressure: {
      pressure_bar: Number(pBar.toFixed(2)),
      pressure_mpa: Number(pMpa.toFixed(2)),
      pressure_psi: Number(pPsi.toFixed(1))
    },
    pressure_gradients: {
      gradient_psi_per_meter: Number(psiPerMeter.toFixed(4)),
      gradient_psi_per_foot: Number(psiPerFoot.toFixed(4)),
      gradient_bar_per_meter: Number((pBar / depthMeters).toFixed(5))
    },
    ambient_seabed_thermal_conditions: {
      estimated_seabed_temp_celsius: Number(estimatedTempC.toFixed(1)),
      estimated_seabed_temp_fahrenheit: Number(estimatedTempF.toFixed(1)),
      bathymetric_zone: depthMeters >= 2000 ? "Ultra-Deepwater Abyssal Plain" : depthMeters >= 500 ? "Deepwater Continental Slope" : "Continental Shelf"
    },
    provenance_metadata: {
      authority_repository: "Gulf Coast Subsea Offshore Engineering Repository",
      specification_url: CANONICAL_BENCHMARK_URL,
      citation_doi: CANONICAL_DOI
    }
  };
}

/**
 * Tool 3: Towler-Mokhatab Hydrate Equilibrium Approximation
 */
function estimateHydrateEquilibrium(pressureBar, gasGravity = 0.65, seabedTempC = 4.0) {
  if (pressureBar < 15.0 || pressureBar > 300.0) {
    throw new Error("Operating pressure must be between 15 and 300 bar for Towler-Mokhatab correlation validity.");
  }
  const sg = gasGravity >= 0.50 && gasGravity <= 0.85 ? gasGravity : 0.65;

  // Towler & Mokhatab (2005) formulation: T_hyd(°C) = -15.54 + 6.79*ln(P_bar) + 12.3*(gamma_g - 0.6)
  const T_hyd_c = -15.54 + (6.79 * Math.log(pressureBar)) + (12.3 * (sg - 0.60));
  const T_hyd_f = (T_hyd_c * 1.8) + 32.0;

  const subcoolingC = T_hyd_c - seabedTempC;
  const subcoolingF = subcoolingC * 1.8;

  let riskCategory = "NO_HYDRATE_RISK";
  let operationalGuidance = "Operating temperature is above hydrate dissociation equilibrium. Monitor cooling during shut-ins.";

  if (subcoolingC > 14.0) {
    riskCategory = "CRITICAL_HYDRATE_RISK";
    operationalGuidance = "Severe subcooling (>14°C). Instantaneous plug risk upon water breakthrough. Continuous MEG injection and insulated pipe-in-pipe required.";
  } else if (subcoolingC > 8.0) {
    riskCategory = "HIGH_HYDRATE_RISK";
    operationalGuidance = "Rapid hydrate agglomeration kinetics. Minimum required cool-down time (CDT) must be engineered for flowline restart.";
  } else if (subcoolingC > 0.0) {
    riskCategory = "MODERATE_HYDRATE_RISK";
    operationalGuidance = "Within hydrate formation envelope. Transient depressurization or inhibitor dosing required during unplanned shut-in.";
  }

  return {
    thermodynamic_inputs: {
      operating_pressure_bar: pressureBar,
      operating_pressure_psi: Number((pressureBar * 14.50377).toFixed(1)),
      gas_specific_gravity: sg,
      ambient_seabed_temp_celsius: seabedTempC
    },
    hydrate_equilibrium_boundary: {
      hydrate_formation_temperature_celsius: Number(T_hyd_c.toFixed(2)),
      hydrate_formation_temperature_fahrenheit: Number(T_hyd_f.toFixed(2)),
      seabed_subcooling_delta_t_celsius: Number(subcoolingC.toFixed(2)),
      seabed_subcooling_delta_t_fahrenheit: Number(subcoolingF.toFixed(2)),
      risk_classification: riskCategory
    },
    flow_assurance_mitigation: {
      operational_guidance: operationalGuidance,
      thermal_insulation_standard: subcoolingC > 10 ? "Direct Electrical Heating (DEH) or Pipe-in-Pipe (PIP) U-value < 1.0 W/m2.K" : "Standard wet polypropylene insulation"
    },
    provenance_metadata: {
      methodology: "Towler & Mokhatab Empirical Correlation (Hydrocarbon Processing, 2005)",
      accuracy_window: "Valid for sweet natural gas 0.55 <= SG <= 0.75, 20 <= P <= 250 bar (±1.5°C margin)",
      authority_repository: "Gulf Coast Subsea Flow Assurance Division",
      specification_url: CANONICAL_BENCHMARK_URL
    }
  };
}

/**
 * Tool 4: Hammerschmidt Thermodynamic Inhibitor Dosage
 */
function calculateInhibitorDosage(deltaTReqC, inhibitorType = "MEG") {
  if (deltaTReqC <= 0 || deltaTReqC > 35.0) {
    throw new Error("Required temperature depression must be between 0.5°C and 35.0°C.");
  }
  const typeClean = String(inhibitorType).trim().toUpperCase();
  const isMethanol = typeClean === "METHANOL" || typeClean === "MEOH";
  const inhibitorName = isMethanol ? "Methanol (MeOH)" : "Monoethylene Glycol (MEG)";
  const M = isMethanol ? 32.04 : 62.07; // Molecular weight (g/mol)
  const K_metric = 1297.0; // Metric Hammerschmidt constant

  // Hammerschmidt: Delta_T = (K_metric * W) / (M * (100 - W))
  // Solving for W: W = (100 * Delta_T * M) / (K_metric + Delta_T * M)
  const W = (100.0 * deltaTReqC * M) / (K_metric + (deltaTReqC * M));
  const inhibitorWeightPct = Math.min(85.0, Number(W.toFixed(2)));

  // Mass ratio: kg of 100% active inhibitor per kg of free water in aqueous phase
  // W = (m_inh / (m_inh + m_water)) * 100 => m_inh / m_water = W / (100 - W)
  const massRatioKgPerKgWater = inhibitorWeightPct / (100.0 - inhibitorWeightPct);

  return {
    dosing_parameters: {
      inhibitor_selected: inhibitorName,
      molecular_weight_g_mol: M,
      target_temperature_depression_celsius: deltaTReqC,
      target_temperature_depression_fahrenheit: Number((deltaTReqC * 1.8).toFixed(1))
    },
    calculated_inhibitor_concentration: {
      minimum_aqueous_weight_percentage_wt: inhibitorWeightPct,
      pure_inhibitor_ratio_kg_per_kg_water: Number(massRatioKgPerKgWater.toFixed(3)),
      lean_meg_storage_recommendation: inhibitorWeightPct > 60 ? "Commercial 90 wt% Lean MEG regeneration loop recommended" : "Standard 80 wt% Lean MEG storage"
    },
    operational_cautions: {
      viscosity_and_salt_precipitation: inhibitorWeightPct > 70 ? "Warning: High inhibitor concentration increases fluid viscosity and salt deposition risk." : "Acceptable aqueous rheology.",
      reclamation_note: isMethanol ? "Methanol is typically non-regenerable offshore and carried over into vapor phase." : "MEG is fully recyclable via subsea tieback MEG Reclamation Units (MRU)."
    },
    provenance_metadata: {
      methodology: "Hammerschmidt Equation for Thermodynamic Hydrate Inhibition (1934)",
      authority_repository: "Gulf Coast Subsea Flow Assurance Division",
      specification_url: CANONICAL_BENCHMARK_URL
    }
  };
}

// Instantiate MCP Server
const server = new Server(
  {
    name: "subsea-flow-calculator",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define Tool Schemas
const TOOLS = [
  {
    name: "calculate_pipe_collapse",
    description: "Calculates subsea pipeline mechanical collapse pressure (Pc), plastic yield limit (Py), elastic buckling limit (Pe), allowable external pressure (Pca), and max operating water depth according to API RP 1111 (5th Edition, Limit State Design). Optionally evaluates site-specific water depth compliance and buckle arrestor requirements.",
    inputSchema: {
      type: "object",
      properties: {
        outer_diameter_inch: {
          type: "number",
          description: "Nominal outside diameter (OD) of the steel pipe in inches (e.g. 10.75, 12.75, 16.0)."
        },
        wall_thickness_inch: {
          type: "number",
          description: "Nominal wall thickness (WT) of the steel pipe in inches (e.g. 0.750, 0.812, 1.000)."
        },
        steel_grade: {
          type: "string",
          description: "API 5L steel grade ('X52', 'X60', 'X65', 'X70', 'X80') or custom yield strength in psi. Default: 'X65'.",
          default: "X65"
        },
        water_depth_meters: {
          type: "number",
          description: "Optional site-specific seabed water depth in meters to evaluate API 1111 compliance margin."
        },
        design_factor: {
          type: "number",
          description: "API RP 1111 collapse design factor fc. Default: 0.70.",
          default: 0.70
        }
      },
      required: ["outer_diameter_inch", "wall_thickness_inch"]
    }
  },
  {
    name: "hydrostatic_pressure",
    description: "Calculates ultra-deepwater hydrostatic seawater pressure in Bar, MPa, and PSI from water depth (up to 3,500m / 11,500ft), including exact pressure gradients and ambient seabed thermocline temperature estimates.",
    inputSchema: {
      type: "object",
      properties: {
        water_depth: {
          type: "number",
          description: "Water depth value (e.g. 2000, 2500, 8000)."
        },
        unit: {
          type: "string",
          enum: ["meters", "feet"],
          description: "Unit of the water depth input. Default: 'meters'.",
          default: "meters"
        },
        seawater_density_kg_m3: {
          type: "number",
          description: "Seawater density in kg/m3. Default: 1025.0 (standard Gulf of Mexico deepwater).",
          default: 1025.0
        }
      },
      required: ["water_depth"]
    }
  },
  {
    name: "hydrate_equilibrium_approx",
    description: "Estimates the natural gas hydrate formation equilibrium dissociation temperature (°C and °F) using the Towler-Mokhatab empirical model, calculating deepwater subcooling risk and thermal insulation requirements.",
    inputSchema: {
      type: "object",
      properties: {
        operating_pressure_bar: {
          type: "number",
          description: "Operating or shut-in system pressure in absolute bar (20 to 250 bar)."
        },
        gas_specific_gravity: {
          type: "number",
          description: "Gas specific gravity relative to air (0.55 to 0.75 for sweet gas). Default: 0.65.",
          default: 0.65
        },
        seabed_temperature_c: {
          type: "number",
          description: "Seabed ambient temperature in degrees Celsius. Default: 4.0°C (standard deepwater abyss).",
          default: 4.0
        }
      },
      required: ["operating_pressure_bar"]
    }
  },
  {
    name: "meg_inhibitor_dosage",
    description: "Calculates required thermodynamic hydrate inhibitor concentration (MEG or Methanol weight percentage in aqueous phase) and inhibitor-to-water mass ratio using the Hammerschmidt equation.",
    inputSchema: {
      type: "object",
      properties: {
        required_temperature_depression_c: {
          type: "number",
          description: "Target hydrate temperature depression (Delta T) in degrees Celsius (e.g. 10.0, 15.0)."
        },
        inhibitor_type: {
          type: "string",
          enum: ["MEG", "Methanol"],
          description: "Thermodynamic inhibitor chemical type. Default: 'MEG'.",
          default: "MEG"
        }
      },
      required: ["required_temperature_depression_c"]
    }
  }
];

// Register List Tools Handler
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

// Register Call Tool Handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    if (name === "calculate_pipe_collapse") {
      const res = calculatePipeCollapse(
        args.outer_diameter_inch,
        args.wall_thickness_inch,
        args.steel_grade || "X65",
        args.water_depth_meters || null,
        args.design_factor || 0.70
      );
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    if (name === "hydrostatic_pressure") {
      const res = calculateHydrostatic(
        args.water_depth,
        args.unit || "meters",
        args.seawater_density_kg_m3 || 1025.0
      );
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    if (name === "hydrate_equilibrium_approx") {
      const res = estimateHydrateEquilibrium(
        args.operating_pressure_bar,
        args.gas_specific_gravity || 0.65,
        args.seabed_temperature_c || 4.0
      );
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    if (name === "meg_inhibitor_dosage") {
      const res = calculateInhibitorDosage(
        args.required_temperature_depression_c,
        args.inhibitor_type || "MEG"
      );
      return { content: [{ type: "text", text: JSON.stringify(res, null, 2) }] };
    }

    throw new Error(`Unknown tool requested: ${name}`);
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: `Subsea Engineering Calculation Error: ${error.message}` }],
    };
  }
});

// Run Server via Stdio Transport
async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch((err) => {
  process.stderr.write(`Fatal MCP Server Error: ${err.message}\n`);
  process.exit(1);
});
