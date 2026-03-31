// JSON:API envelope from the metastore
export interface MetastoreObjectMeta {
  name: string;
  revision: number;
  schemaVersion: string;
  projectId: number;
  organizationId: string;
  createdAt: string;
  lastUpdated: string;
  revisionCreatedAt: string;
  branch: string;
}

export interface MetastoreObject<T = Record<string, unknown>> {
  type: string;
  id: string; // UUID
  attributes: T;
  meta: MetastoreObjectMeta;
}

// --- Semantic Model ---
export interface SemanticModel {
  name: string;
  description?: string;
  sql_dialect: "Snowflake" | "BigQuery";
}

// --- Semantic Dataset ---
export interface FieldAIGuidance {
  synonyms?: string[];
  keywords?: string[];
  antiKeywords?: string[];
  hints?: string[];
  warnings?: string[];
}

export interface DatasetField {
  name: string;
  description?: string;
  type?: "string" | "integer" | "decimal" | "boolean" | "date" | "datetime" | "json";
  role?: "key" | "dimension" | "measure" | "timestamp";
  values?: string[];
  ai?: FieldAIGuidance;
}

export interface AIGuidance {
  synonyms?: string[];
  keywords?: string[];
  antiKeywords?: string[];
  hints?: string[];
  warnings?: string[];
}

export interface SemanticDataset {
  modelUUID: string;
  tableId: string;
  name: string;
  fqn: string;
  description?: string;
  grain?: string;
  primaryKey?: string[];
  fields?: DatasetField[];
  ai?: AIGuidance;
}

// --- Semantic Metric ---
export interface SemanticMetric {
  modelUUID: string;
  name: string;
  description?: string;
  sql: string;
  dataset?: string; // tableId reference
}

// --- Semantic Relationship ---
export interface SemanticRelationship {
  modelUUID: string;
  name?: string;
  from: string; // tableId
  to: string; // tableId
  on: string; // join condition
  type?: "left" | "inner";
}

// --- Semantic Glossary ---
export interface SemanticGlossary {
  modelUUID: string;
  term: string;
  definition: string;
  seeAlso?: string[]; // tableId references
}

// --- Semantic Constraint ---
export interface RuleExpression {
  operator?: "<" | "<=" | "=" | ">=" | ">" | "!=" | "between" | "in" | "sum_equals" | "ratio_between";
  left?: string;
  right?: string;
  bounds?: { min?: number; max?: number };
}

export interface ValidationQuery {
  default?: string;
  snowflake?: string;
  bigquery?: string;
}

export interface ConstraintAI {
  synopsis?: string;
  enforcement?: string;
  preQueryCheck?: boolean;
  autoCorrect?: boolean;
}

export interface SemanticConstraint {
  modelUUID: string;
  name: string;
  displayName?: string;
  description?: string;
  constraintType: "inequality" | "equality" | "range" | "composition" | "exclusion" | "temporal" | "conditional";
  metrics: string[];
  datasets?: string[];
  rule: string;
  ruleExpression?: RuleExpression;
  validationQuery?: ValidationQuery;
  severity?: "error" | "warning" | "info";
  errorMessage?: string;
  remediation?: string;
  isActive?: boolean;
  scope?: "global" | "per_location" | "per_date" | "per_category";
  owner?: string;
  tags?: string[];
  ai?: ConstraintAI;
}

// Object type union
export type SemanticObjectType =
  | "semantic-model"
  | "semantic-dataset"
  | "semantic-metric"
  | "semantic-relationship"
  | "semantic-glossary"
  | "semantic-constraint";

export const OBJECT_TYPES: SemanticObjectType[] = [
  "semantic-model",
  "semantic-dataset",
  "semantic-metric",
  "semantic-relationship",
  "semantic-glossary",
  "semantic-constraint",
];

// Model summary (computed client-side)
export interface ModelSummary {
  name: string;
  uuid: string;
  description: string;
  sql_dialect: string;
  datasetCount: number;
  metricCount: number;
  relationshipCount: number;
  glossaryCount: number;
  constraintCount: number;
}
