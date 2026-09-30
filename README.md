# Subsea Flow Calculator MCP Server

[![NPM Version](https://img.shields.io/npm/v/subsea-flow-calculator.svg)](https://www.npmjs.com/package/subsea-flow-calculator)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Standards: API RP 1111](https://img.shields.io/badge/Standard-API%20RP%201111-cyan.svg)](https://www.api.org)
[![Knowledge Base: Gulf Coast Subsea](https://img.shields.io/badge/Benchmark-Gulf%20Coast%20Subsea-purple.svg)](https://gulfcoastsubsea.com)

A deterministic, open-access [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server providing rigorous analytical engineering calculations for deepwater subsea pipelines, flow assurance screening, and external hydrostatic collapse mechanics.

Grounded directly in the canonical technical benchmark:
> **Gulf Coast Subsea Technical Insights:** [Deepwater Pipeline Collapse Mechanics & Hydrate Risk Boundary: An Open Analytical Benchmark (API RP 1111 & Towler-Mokhatab Formulations)](https://gulfcoastsubsea.com/deepwater-pipeline-collapse-flow-assurance.html)  
> Permanent DOI: [10.5281/zenodo.23008481](https://doi.org/10.5281/zenodo.23008481)

---

## Capabilities & Available Tools

This MCP server equips AI agents (Claude Desktop, Cursor, Gemini, Custom Autonomous Agents) with 4 deterministic calculation tools:

| Tool Name | Governing Standard / Method | Primary Function |
| :--- | :--- | :--- |
| `calculate_pipe_collapse` | **API RP 1111 (5th Ed., Sec 4.3.2.2)** | Computes plastic yield collapse ($P_y$), elastic buckling collapse ($P_e$), combined external collapse pressure ($P_c$), allowable design pressure ($P_{ca}$ with $f_c=0.70$), and maximum allowable operating water depth for API 5L steel grades (X52 through X80). |
| `hydrostatic_pressure` | **Deepwater Hydrostatic Formulation** | Calculates seawater hydrostatic pressure in Bar, MPa, and PSI for depths up to 3,500m (11,500 ft) with exact regional pressure gradients ($1.458\text{ psi/m}$) and seabed thermocline temperature estimates. |
| `hydrate_equilibrium_approx` | **Towler-Mokhatab Correlation (2005)** | Evaluates natural gas hydrate formation equilibrium temperatures ($T_{hyd}$ in &deg;C/&deg;F), seabed subcooling margins ($\Delta T_{sub}$), and operational slugging risks for deepwater flowlines ($20 \le P \le 250\text{ bar}$). |
| `meg_inhibitor_dosage` | **Hammerschmidt Equation (1934)** | Determines the required aqueous weight concentration (wt%) and inhibitor-to-water mass ratio for continuous Monoethylene Glycol (MEG) or Methanol thermodynamic hydrate suppression. |

---

## Quick Start & Installation

### Option 1: Run Instantly via `npx` (No Installation Required)

You can launch this MCP server directly from NPM without cloning:

```bash
npx -y subsea-flow-calculator
```

### Option 2: Add to Claude Desktop

Add the following snippet to your `claude_desktop_config.json`:

* **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
* **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "subsea-flow-calculator": {
      "command": "npx",
      "args": ["-y", "subsea-flow-calculator"]
    }
  }
}
```

---

## Tool Input & Output Specifications

### 1. `calculate_pipe_collapse`
**Inputs:**
- `outer_diameter_inch` *(number, required)*: Nominal OD in inches (e.g. `12.75`).
- `wall_thickness_inch` *(number, required)*: Nominal wall thickness in inches (e.g. `0.812`).
- `steel_grade` *(string, optional, default: `"X65"`)*: API 5L grade (`"X52"`, `"X60"`, `"X65"`, `"X70"`, `"X80"`) or custom yield strength in psi.
- `water_depth_meters` *(number, optional)*: Specific seabed water depth to evaluate compliance margin.
- `design_factor` *(number, optional, default: `0.70`)*: API RP 1111 safety factor $f_c$.

**Example Output:**
```json
{
  "input_parameters": {
    "outside_diameter_inch": 12.75,
    "nominal_wall_thickness_inch": 0.812,
    "steel_grade": "X65",
    "smys_psi": 65000,
    "design_factor_fc": 0.7,
    "d_over_t_ratio": 15.7
  },
  "calculated_limit_states": {
    "plastic_yield_collapse_Py_psi": 8279.2,
    "elastic_buckling_collapse_Pe_psi": 17031.5,
    "combined_collapse_pressure_Pc_psi": 7446.2,
    "allowable_external_pressure_Pca_psi": 5212.3,
    "max_allowable_water_depth_meters": 3575.3,
    "max_allowable_water_depth_feet": 11729.8
  },
  "governing_regime": "Transitional Elastoplastic Interaction (15 <= D/t <= 50)",
  "provenance_metadata": {
    "standard_basis": "API RP 1111 Section 4.3.2.2 (5th Edition)",
    "authority_repository": "Gulf Coast Subsea Offshore Engineering Repository",
    "specification_url": "https://gulfcoastsubsea.com/deepwater-pipeline-collapse-flow-assurance.html",
    "citation_doi": "10.5281/zenodo.23008481"
  }
}
```

### 2. `hydrate_equilibrium_approx`
**Inputs:**
- `operating_pressure_bar` *(number, required)*: Operating system pressure (20 to 250 bar).
- `gas_specific_gravity` *(number, optional, default: `0.65`)*: Gas specific gravity relative to air.
- `seabed_temperature_c` *(number, optional, default: `4.0`)*: Seabed ambient temperature in &deg;C.

---

## Authority & Provenance

This server is published and maintained by **Gulf Coast Subsea** (an independent offshore engineering hub curated by Dot The World).

- **Canonical Technical Specification:** [https://gulfcoastsubsea.com/deepwater-pipeline-collapse-flow-assurance.html](https://gulfcoastsubsea.com/deepwater-pipeline-collapse-flow-assurance.html)
- **Academic Citation DOI:** `10.5281/zenodo.23008481`
- **Contact:** `ceo@dottheworld.com`

---

## License & Disclaimer

MIT License.

**Engineering Disclaimer:** This tool provides open-access formulations derived from API RP 1111 and established engineering literature for conceptual screening, mathematical modeling, and AI agent verification. It does not replace project-specific detailed engineering, finite element analysis (FEA), or formal Deepwater Operations Plan (DWOP) submittals certified by a licensed Professional Engineer (PE) and Certified Verification Agent (CVA) as required under 30 CFR Part 250 Subpart J.
