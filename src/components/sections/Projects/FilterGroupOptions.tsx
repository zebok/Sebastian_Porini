import { Check } from "lucide-react";
import { Dictionary } from "@/lib/i18n";
import styles from "./Projects.module.css";

interface FilterGroupOptionsProps {
  type: "type" | "area" | "tech";
  selectedTypes: string[];
  selectedAreas: string[];
  selectedTechs: string[];
  filterTechs: string[];
  dict: Dictionary;
  getCountForType: (t: string) => number;
  getCountForArea: (a: string) => number;
  getCountForTech: (t: string) => number;
  handleToggleType: (t: string) => void;
  handleToggleArea: (a: string) => void;
  handleToggleTech: (t: string) => void;
}

export const FilterGroupOptions = ({
  type,
  selectedTypes,
  selectedAreas,
  selectedTechs,
  filterTechs,
  dict,
  getCountForType,
  getCountForArea,
  getCountForTech,
  handleToggleType,
  handleToggleArea,
  handleToggleTech,
}: FilterGroupOptionsProps) => {
  if (type === "type") {
    return (
      <>
        {["work", "personal"].map((pType) => {
          const isChecked = selectedTypes.includes(pType);
          const count = getCountForType(pType);
          return (
            <label key={pType} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggleType(pType)}
                className={styles.checkboxInput}
              />
              <span className={styles.customCheck}>
                <Check size={11} strokeWidth={3} />
              </span>
              <span className={styles.optionLabel}>
                {pType === "work" ? dict.projects.types.work : dict.projects.types.personal}
              </span>
              <span className={styles.optionCount}>({count})</span>
            </label>
          );
        })}
      </>
    );
  }

  if (type === "area") {
    return (
      <>
        {["software", "data", "ai", "product"].map((area) => {
          const isChecked = selectedAreas.includes(area);
          const count = getCountForArea(area);
          return (
            <label key={area} className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggleArea(area)}
                className={styles.checkboxInput}
              />
              <span className={styles.customCheck}>
                <Check size={11} strokeWidth={3} />
              </span>
              <span className={styles.optionLabel}>
                {dict.projects.categories[area as keyof typeof dict.projects.categories] || area}
              </span>
              <span className={styles.optionCount}>({count})</span>
            </label>
          );
        })}
      </>
    );
  }

  return (
    <>
      {filterTechs.map((tech) => {
        const isChecked = selectedTechs.includes(tech);
        const count = getCountForTech(tech);
        return (
          <label key={tech} className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => handleToggleTech(tech)}
              className={styles.checkboxInput}
            />
            <span className={styles.customCheck}>
              <Check size={11} strokeWidth={3} />
            </span>
            <span className={styles.optionLabel}>{tech}</span>
            <span className={styles.optionCount}>({count})</span>
          </label>
        );
      })}
    </>
  );
};
