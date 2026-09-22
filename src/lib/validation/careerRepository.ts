type UnknownRecord = Record<string, unknown>;

const NODE_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const BRANCH_ID_PATTERN = /^[a-z0-9]+(?:[/-][a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const TIME_VALUE_PATTERN = /^\d{4}(?:-(?:0[1-9]|1[0-2]))?$/;
const SHORT_SHA_PATTERN = /^[0-9a-f]{7}$/;
const TIME_PRECISIONS = new Set(["month", "year", "year-plus"]);
const PARENT_KINDS = new Set(["first-parent", "merge-parent"]);
const REF_KINDS = new Set(["head", "branch", "tag"]);
const REQUIRED_BRANCH_IDS = [
  "main",
  "feature/cloud-infra",
  "feature/backend-api",
  "feature/data-ai",
  "feature/product-delivery",
  "learn/education",
] as const;
const requiredBranchIds = new Set<string>(REQUIRED_BRANCH_IDS);

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const validateStableId = (
  value: unknown,
  path: string,
  errors: string[]
): string | null => {
  if (typeof value !== "string") {
    errors.push(`${path} must be a string`);
    return null;
  }
  if (!NODE_ID_PATTERN.test(value)) {
    errors.push(`${path} must use lowercase kebab-case; received "${value}"`);
  }
  return value;
};

const validateTime = (value: unknown, path: string, errors: string[]) => {
  if (!isRecord(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  if (typeof value.value !== "string" || !TIME_VALUE_PATTERN.test(value.value)) {
    errors.push(`${path}.value must use YYYY or YYYY-MM precision`);
  }
  if (
    typeof value.precision !== "string" ||
    !TIME_PRECISIONS.has(value.precision)
  ) {
    errors.push(`${path}.precision must be month, year, or year-plus`);
    return;
  }
  if (value.precision === "month" && !/^\d{4}-\d{2}$/.test(String(value.value))) {
    errors.push(`${path}.value must include a month when precision is month`);
  }
  if (value.precision !== "month" && !/^\d{4}$/.test(String(value.value))) {
    errors.push(
      `${path}.value must contain only a year for ${value.precision} precision`
    );
  }
};

/**
 * Validates the editable career DAG before content is cast to its TypeScript
 * contract. The checks deliberately focus on referential integrity: authored
 * branch lanes, node parents, refs, and cycles must never degrade silently.
 */
export const getCareerRepositoryReferenceErrors = (content: unknown): string[] => {
  const errors: string[] = [];
  const root = isRecord(content) ? content : null;
  const repository = root && isRecord(root.careerRepository)
    ? root.careerRepository
    : null;

  if (!repository) return ["content.careerRepository must be an object"];

  const headIdentity = repository.headIdentity;
  if (!isRecord(headIdentity)) {
    errors.push("content.careerRepository.headIdentity must be a localized object");
  } else {
    (["en", "es", "de"] as const).forEach((language) => {
      if (
        typeof headIdentity[language] !== "string" ||
        headIdentity[language].trim().length === 0
      ) {
        errors.push(
          `content.careerRepository.headIdentity.${language} must be a non-empty string`
        );
      }
    });
  }

  const branchIds = new Set<string>();
  if (!Array.isArray(repository.branches)) {
    errors.push("content.careerRepository.branches must be an array");
  } else {
    repository.branches.forEach((candidate, index) => {
      const path = `content.careerRepository.branches[${index}]`;
      if (!isRecord(candidate)) {
        errors.push(`${path} must be an object`);
        return;
      }
      if (
        typeof candidate.id !== "string" ||
        !BRANCH_ID_PATTERN.test(candidate.id)
      ) {
        errors.push(`${path}.id must be a lowercase Git-style branch ID`);
        return;
      }
      if (!requiredBranchIds.has(candidate.id)) {
        errors.push(`${path}.id is not an authored career branch`);
      }
      if (branchIds.has(candidate.id)) {
        errors.push(`${path}.id duplicates branch "${candidate.id}"`);
      }
      branchIds.add(candidate.id);
      if (candidate.label !== candidate.id) {
        errors.push(`${path}.label must preserve the authored Git branch ID`);
      }
    });
  }
  REQUIRED_BRANCH_IDS.forEach((branchId) => {
    if (!branchIds.has(branchId)) {
      errors.push(`content.careerRepository.branches is missing "${branchId}"`);
    }
  });

  const nodeTypes = new Map<string, "commit" | "staging">();
  const nodeBranches = new Map<string, string>();
  const nodeCandidates = new Map<
    string,
    { value: UnknownRecord; path: string }
  >();
  const commitShas = new Set<string>();

  const collectNodes = (collectionName: "commits" | "staging") => {
    const collection = repository[collectionName];
    if (!Array.isArray(collection)) {
      errors.push(`content.careerRepository.${collectionName} must be an array`);
      return;
    }

    collection.forEach((candidate, index) => {
      const path = `content.careerRepository.${collectionName}[${index}]`;
      if (!isRecord(candidate)) {
        errors.push(`${path} must be an object`);
        return;
      }

      const id = validateStableId(candidate.id, `${path}.id`, errors);
      if (!id) return;
      if (nodeTypes.has(id)) {
        errors.push(`${path}.id duplicates career node "${id}"`);
        return;
      }

      const nodeType = collectionName === "commits" ? "commit" : "staging";
      nodeTypes.set(id, nodeType);
      nodeCandidates.set(id, { value: candidate, path });

      if (
        typeof candidate.branchId !== "string" ||
        !branchIds.has(candidate.branchId)
      ) {
        errors.push(
          `${path}.branchId references unknown branch "${String(candidate.branchId)}"`
        );
      } else {
        nodeBranches.set(id, candidate.branchId);
      }

      if (nodeType === "commit" && candidate.status !== "committed") {
        errors.push(`${path}.status must be committed`);
      }
      if (nodeType === "commit") {
        if (
          typeof candidate.sha !== "string" ||
          !SHORT_SHA_PATTERN.test(candidate.sha)
        ) {
          errors.push(
            `${path}.sha must be seven lowercase hexadecimal characters`
          );
        } else if (commitShas.has(candidate.sha)) {
          errors.push(`${path}.sha duplicates commit SHA "${candidate.sha}"`);
        } else {
          commitShas.add(candidate.sha);
        }
      }
      if (
        nodeType === "staging" &&
        candidate.status !== "wip" &&
        candidate.status !== "forecast"
      ) {
        errors.push(`${path}.status must be wip or forecast`);
      }

      validateTime(candidate.time, `${path}.time`, errors);
    });
  };

  collectNodes("commits");
  collectNodes("staging");

  const adjacency = new Map<string, string[]>();
  nodeCandidates.forEach(({ value: node, path }, nodeId) => {
    if (!Array.isArray(node.parents)) {
      errors.push(`${path}.parents must be an array`);
      return;
    }

    const parentIds = new Set<string>();
    let firstParentCount = 0;
    node.parents.forEach((candidate, parentIndex) => {
      const parentPath = `${path}.parents[${parentIndex}]`;
      if (!isRecord(candidate)) {
        errors.push(`${parentPath} must be an object`);
        return;
      }

      const parentId = typeof candidate.id === "string" ? candidate.id : null;
      if (!parentId) {
        errors.push(`${parentPath}.id must be a string`);
        return;
      }
      if (parentId === nodeId) {
        errors.push(`${parentPath}.id cannot reference itself`);
      }
      if (parentIds.has(parentId)) {
        errors.push(`${parentPath}.id duplicates parent "${parentId}"`);
      }
      parentIds.add(parentId);

      const declaredTarget = candidate.target;
      const actualTarget = nodeTypes.get(parentId);
      if (!actualTarget) {
        errors.push(`${parentPath}.id references unknown career node "${parentId}"`);
      } else if (declaredTarget !== actualTarget) {
        errors.push(
          `${parentPath}.target is "${String(declaredTarget)}" but "${parentId}" is a ${actualTarget}`
        );
      }
      if (nodeTypes.get(nodeId) === "commit" && actualTarget === "staging") {
        errors.push(`${parentPath}.id cannot make a committed node depend on staging`);
      }

      if (
        typeof candidate.kind !== "string" ||
        !PARENT_KINDS.has(candidate.kind)
      ) {
        errors.push(`${parentPath}.kind must be first-parent or merge-parent`);
      } else if (candidate.kind === "first-parent") {
        firstParentCount += 1;
      }
    });

    if (node.parents.length > 0 && firstParentCount !== 1) {
      errors.push(`${path}.parents must contain exactly one first-parent`);
    }
    adjacency.set(nodeId, [...parentIds]);
  });

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (nodeId: string) => {
    if (visiting.has(nodeId)) {
      errors.push(`content.careerRepository contains a parent cycle at "${nodeId}"`);
      return;
    }
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    (adjacency.get(nodeId) ?? []).forEach(visit);
    visiting.delete(nodeId);
    visited.add(nodeId);
  };
  nodeTypes.forEach((_type, nodeId) => visit(nodeId));

  const refIds = new Set<string>();
  const refNames = new Set<string>();
  let headCount = 0;
  let mainRefCount = 0;
  let v3TagCount = 0;
  let headTargetId: string | null = null;
  let mainTargetId: string | null = null;
  let v3TargetId: string | null = null;
  if (!Array.isArray(repository.refs)) {
    errors.push("content.careerRepository.refs must be an array");
  } else {
    repository.refs.forEach((candidate, index) => {
      const path = `content.careerRepository.refs[${index}]`;
      if (!isRecord(candidate)) {
        errors.push(`${path} must be an object`);
        return;
      }

      const id = validateStableId(candidate.id, `${path}.id`, errors);
      if (id && refIds.has(id)) errors.push(`${path}.id duplicates ref "${id}"`);
      if (id) refIds.add(id);

      if (
        typeof candidate.kind !== "string" ||
        !REF_KINDS.has(candidate.kind)
      ) {
        errors.push(`${path}.kind must be head, branch, or tag`);
      }
      if (typeof candidate.name !== "string" || candidate.name.length === 0) {
        errors.push(`${path}.name must be a non-empty string`);
      } else {
        const nameKey = `${String(candidate.kind)}:${candidate.name}`;
        if (refNames.has(nameKey)) errors.push(`${path}.name duplicates ref "${nameKey}"`);
        refNames.add(nameKey);
      }

      if (candidate.kind === "head") {
        headCount += 1;
        if (typeof candidate.targetId === "string") {
          headTargetId = candidate.targetId;
        }
      }
      if (candidate.kind === "branch" && candidate.name === "main") {
        mainRefCount += 1;
        if (typeof candidate.targetId === "string") {
          mainTargetId = candidate.targetId;
        }
      }
      if (candidate.kind === "tag" && candidate.name === "v3.0") {
        v3TagCount += 1;
        if (typeof candidate.targetId === "string") {
          v3TargetId = candidate.targetId;
        }
      }
      if (candidate.kind === "head" && candidate.name !== "HEAD") {
        errors.push(`${path}.name must preserve the Git token HEAD`);
      }
      if (candidate.kind === "branch" && !branchIds.has(String(candidate.name))) {
        errors.push(`${path}.name references unknown branch "${String(candidate.name)}"`);
      }

      if (
        typeof candidate.targetId !== "string" ||
        nodeTypes.get(candidate.targetId) !== "commit"
      ) {
        errors.push(`${path}.targetId must reference an authored commit`);
      } else if (
        candidate.kind === "branch" &&
        nodeBranches.get(candidate.targetId) !== candidate.name
      ) {
        errors.push(`${path} must point to a commit on branch "${String(candidate.name)}"`);
      }
    });
  }

  if (headCount !== 1) {
    errors.push("content.careerRepository.refs must contain exactly one HEAD ref");
  }
  if (mainRefCount !== 1) {
    errors.push(
      "content.careerRepository.refs must contain exactly one main branch ref"
    );
  }
  if (v3TagCount !== 1) {
    errors.push(
      "content.careerRepository.refs must contain exactly one v3.0 tag ref"
    );
  }
  if (
    headTargetId &&
    mainTargetId &&
    v3TargetId &&
    (headTargetId !== mainTargetId || headTargetId !== v3TargetId)
  ) {
    errors.push(
      "content.careerRepository HEAD, main, and v3.0 refs must share a target"
    );
  }

  return errors;
};

export const assertValidCareerRepositoryReferences = (content: unknown): void => {
  const errors = getCareerRepositoryReferenceErrors(content);
  if (errors.length === 0) return;

  throw new Error(
    `Invalid career repository content:\n${errors
      .map((error) => `- ${error}`)
      .join("\n")}`
  );
};
