import { Injectable } from '@nestjs/common';

interface StructureAnalysis {
  presentSections: string[];
  missingSections: string[];
  extraSections: string[];
  orderCorrect: boolean;
}

interface Finding {
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'SUGGESTION';
  sectionRef: string;
  description: string;
}

interface DimensionAnalysis {
  dimension: string;
  score: number;
  weight: number;
  priority: 'ALTA' | 'MEDIA' | 'BAJA';
  analysis: string;
}

interface SectionAnalysis {
  sectionName: string;
  status: 'OK' | 'OBSERVED' | 'MISSING';
}

interface ImprovementPlan {
  shortTerm: string[];
  mediumTerm: string[];
  longTerm: string[];
}

@Injectable()
export class DiagramGeneratorService {
  /** Detecta si un nombre de sección requiere diagrama y de qué tipo */
  detectDiagramType(sectionName: string): 'MINDMAP' | 'FISHBONE' | 'DECISION_TREE' | 'GANTT' | 'FLOWCHART' | null {
    const lower = sectionName.toLowerCase();
    if (/árbol\s+de\s+objetivos|árbol\s+de\s+problemas|mapa\s+(mental|conceptual)|mindmap/i.test(lower)) return 'MINDMAP';
    if (/ishikawa|espina\s+de\s+pescado|causa\s*[-]?\s*efecto|fishbone/i.test(lower)) return 'FISHBONE';
    if (/árbol\s+de\s+decision(es)?|decision\s*tree|flujo\s+de\s+decisión/i.test(lower)) return 'DECISION_TREE';
    if (/cronograma|gantt|diagrama\s+de\s+gantt|cronograma\s+de\s+actividades/i.test(lower)) return 'GANTT';
    if (/diagrama\s+de\s+flujo|flujo(grama)?|proceso|flowchart|flujo\s+de\s+proceso/i.test(lower)) return 'FLOWCHART';
    return null;
  }

  /** Genera un mindmap por defecto basado en el tema y secciones */
  generateDefaultMindmap(topic: string, sectionName: string, subsections: string[]): string {
    const lines: string[] = ['mindmap', `  root(("${this.escapeMd(topic)}"))`];
    if (subsections.length > 0) {
      lines.push(`    ${this.escapeMd(sectionName)}`);
      for (const sub of subsections) {
        lines.push(`      [${this.escapeMd(sub)}]`);
      }
    } else {
      lines.push(`    [${this.escapeMd(sectionName)}]`);
      lines.push('    [Objetivo General]');
      lines.push('    [Objetivos Específicos]');
    }
    return lines.join('\n');
  }

  /** Genera un diagrama Ishikawa por defecto */
  generateDefaultFishbone(topic: string, sectionName: string): string {
    const causes = [
      'Método', 'Materia Prima', 'Mano de Obra',
      'Medición', 'Medio Ambiente', 'Maquinaria',
    ];
    const lines: string[] = ['flowchart LR'];
    const probId = 'P';
    lines.push(`    ${probId}(("${this.escapeMd(topic)}"))`);
    for (let i = 0; i < causes.length; i++) {
      const gId = `C${i}`;
      const nId = `${gId}_N`;
      lines.push(`    subgraph ${gId}["${causes[i]}"]`);
      lines.push(`        ${nId}["Causas relacionadas"]`);
      lines.push('    end');
      lines.push(`    ${nId} --> ${probId}`);
    }
    return lines.join('\n');
  }

  /** Genera un árbol de decisión por defecto */
  generateDefaultDecisionTree(topic: string, sectionName: string): string {
    const lines: string[] = ['flowchart TD'];
    lines.push('    D{"¿Decisión?"}');
    lines.push('    D -->|Opción A| A["Alternativa 1"]');
    lines.push('    D -->|Opción B| B["Alternativa 2"]');
    lines.push('    D -->|Opción C| C["Alternativa 3"]');
    lines.push('    A --> A1[Ventaja]');
    lines.push('    A --> A2[Desventaja]');
    lines.push('    B --> B1[Ventaja]');
    lines.push('    B --> B2[Desventaja]');
    lines.push('    C --> C1[Ventaja]');
    lines.push('    C --> C2[Desventaja]');
    return lines.join('\n');
  }

  /** Genera un cronograma Gantt por defecto */
  generateDefaultGantt(topic: string, sectionName: string, subsections: string[]): string {
    const items = subsections.length > 0 ? subsections : ['Actividad 1', 'Actividad 2', 'Actividad 3'];
    const lines: string[] = ['gantt', `    title Cronograma de ${this.escapeMd(sectionName)}`, '    dateFormat  YYYY-MM-DD', '    axisFormat  %b'];
    lines.push('    section Actividades');
    const today = new Date();
    for (let i = 0; i < items.length; i++) {
      const start = new Date(today); start.setMonth(start.getMonth() + i);
      const end = new Date(start); end.setMonth(end.getMonth() + 1);
      const sStr = start.toISOString().split('T')[0];
      const eStr = end.toISOString().split('T')[0];
      lines.push(`    ${this.escapeMd(items[i])} :a${i}, ${sStr}, ${eStr}`);
    }
    return lines.join('\n');
  }

  generateStructureMindmap(structure: StructureAnalysis): string {
    const lines: string[] = ['mindmap', '  root((Estructura del Documento))'];
    if (structure.presentSections.length > 0) {
      lines.push('    Presentes');
      for (const s of structure.presentSections) {
        lines.push(`      [${this.escapeMd(s)}]`);
      }
    }
    if (structure.missingSections.length > 0) {
      lines.push('    Faltantes');
      for (const s of structure.missingSections) {
        lines.push(`      [${this.escapeMd(s)}]`);
      }
    }
    if (structure.extraSections.length > 0) {
      lines.push('    Extras');
      for (const s of structure.extraSections) {
        lines.push(`      [${this.escapeMd(s)}]`);
      }
    }
    return lines.join('\n');
  }

  generateFindingsPieChart(findings: Finding[]): string {
    const counts: Record<string, number> = {
      CRITICAL: 0, MAJOR: 0, MINOR: 0, SUGGESTION: 0,
    };
    for (const f of findings) {
      counts[f.severity] = (counts[f.severity] || 0) + 1;
    }
    const labels: Record<string, string> = {
      CRITICAL: 'Críticos', MAJOR: 'Mayores', MINOR: 'Menores', SUGGESTION: 'Sugerencias',
    };
    const lines: string[] = ['pie title Distribución de Hallazgos'];
    for (const key of ['CRITICAL', 'MAJOR', 'MINOR', 'SUGGESTION']) {
      if ((counts[key] || 0) > 0) {
        lines.push(`    "${labels[key]} (${counts[key]})" : ${counts[key]}`);
      }
    }
    return lines.join('\n');
  }

  generateSectionFlowChart(sections: SectionAnalysis[]): string {
    if (sections.length === 0) return '';
    const lines: string[] = ['flowchart LR'];
    for (let i = 0; i < sections.length; i++) {
      const s = sections[i];
      const icon = s.status === 'OK' ? '✓' : s.status === 'OBSERVED' ? '~' : '✗';
      const color = s.status === 'OK' ? '#059669' : s.status === 'OBSERVED' ? '#D97706' : '#DC2626';
      const id = `S${i}`;
      lines.push(`    ${id}["${icon} ${this.escapeMd(s.sectionName)}"]:::${s.status}`);
      if (i < sections.length - 1) {
        lines.push(`    ${id} --> S${i + 1}`);
      }
    }
    lines.push('');
    lines.push('    classDef OK fill:#F0FDF4,stroke:#059669,color:#166534');
    lines.push('    classDef OBSERVED fill:#FFFBEB,stroke:#D97706,color:#92400E');
    lines.push('    classDef MISSING fill:#FEF2F2,stroke:#DC2626,color:#991B1B');
    return lines.join('\n');
  }

  generateIshikawaDiagram(dimensions: DimensionAnalysis[], problemLabel: string): string {
    if (dimensions.length === 0) return '';
    const lines: string[] = ['flowchart LR'];
    const problemId = 'P';
    lines.push(`    ${problemId}(("${this.escapeMd(problemLabel)}"))`);
    for (let i = 0; i < dimensions.length; i++) {
      const d = dimensions[i];
      const groupId = `D${i}`;
      const nodeId = `${groupId}_N`;
      lines.push(`    subgraph ${groupId}["${this.escapeMd(d.dimension)} (${d.score}%)"]`);
      lines.push(`        ${nodeId}["${this.escapeMd(d.analysis.length > 60 ? d.analysis.substring(0, 60) + '...' : d.analysis)}"]`);
      lines.push('    end');
      lines.push(`    ${nodeId} --> ${problemId}`);
    }
    return lines.join('\n');
  }

  generateImprovementTimeline(plan: ImprovementPlan): string {
    const hasShort = plan.shortTerm.length > 0;
    const hasMedium = plan.mediumTerm.length > 0;
    const hasLong = plan.longTerm.length > 0;
    if (!hasShort && !hasMedium && !hasLong) return '';
    const lines: string[] = ['flowchart LR'];
    if (hasShort) {
      lines.push('    subgraph Corto["Corto Plazo"]');
      lines.push('        direction TB');
      for (let i = 0; i < plan.shortTerm.length; i++) {
        lines.push(`        CS${i}["${i + 1}. ${this.escapeMd(plan.shortTerm[i])}"]`);
      }
      lines.push('    end');
    }
    if (hasMedium) {
      lines.push('    subgraph Mediano["Mediano Plazo"]');
      lines.push('        direction TB');
      for (let i = 0; i < plan.mediumTerm.length; i++) {
        lines.push(`        MM${i}["${i + 1}. ${this.escapeMd(plan.mediumTerm[i])}"]`);
      }
      lines.push('    end');
    }
    if (hasLong) {
      lines.push('    subgraph Largo["Largo Plazo"]');
      lines.push('        direction TB');
      for (let i = 0; i < plan.longTerm.length; i++) {
        lines.push(`        LL${i}["${i + 1}. ${this.escapeMd(plan.longTerm[i])}"]`);
      }
      lines.push('    end');
    }
    if (hasShort && hasMedium) lines.push('    Corto --> Mediano');
    if (hasMedium && hasLong) lines.push('    Mediano --> Largo');
    return lines.join('\n');
  }

  generateScoresBar(scores: { structure: number; content: number; form: number; originality: number }): string {
    const maxVal = Math.max(scores.structure, scores.content, scores.form, scores.originality, 1);
    const scale = 100 / maxVal;
    const lines: string[] = ['flowchart LR'];
    lines.push(`    Est["Estructura ${scores.structure.toFixed(0)}%"] --> BarEst[${'█'.repeat(Math.round(scores.structure * scale / 5))}]`);
    lines.push(`    Cont["Contenido ${scores.content.toFixed(0)}%"] --> BarCont[${'█'.repeat(Math.round(scores.content * scale / 5))}]`);
    lines.push(`    Form["Forma ${scores.form.toFixed(0)}%"] --> BarForm[${'█'.repeat(Math.round(scores.form * scale / 5))}]`);
    lines.push(`    Orig["Originalidad ${scores.originality.toFixed(0)}%"] --> BarOrig[${'█'.repeat(Math.round(scores.originality * scale / 5))}]`);
    return lines.join('\n');
  }

  private escapeMd(text: string): string {
    return text.replace(/[#\[\]{}()<>"'`|]/g, '').trim();
  }
}
