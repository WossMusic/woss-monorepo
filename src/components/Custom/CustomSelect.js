import React from "react";
import PropTypes from "prop-types";
import Select from "react-select";

/* ---------- Base react-select styles (Bootstrap-friendly) ---------- */
const baseCustomStyles = {
  /* Kill the outer container border/padding that Bootstrap adds with .form-control */
  container: (provided /*, state*/) => ({
    ...provided,
    backgroundColor: "transparent",
    border: "none",
    boxShadow: "none",
    padding: 0,
    margin: 0,
  }),

  control: (provided, state) => ({
    ...provided,
    display: "flex",
    alignItems: "center",
    fontSize: "0.875rem",
    transition: "all 0.15s ease-in-out",
    height: "calc(1.5em + 1.25rem + 5px)",
    padding: "0 0.75rem",
    fontWeight: 400,
    lineHeight: "1.5",
    color: "#212529",
    backgroundColor: "#fff",
    border: state.isFocused ? "1px solid #56BCB6" : "1px solid #dee2e6",
    borderRadius: "0.25rem",
    boxShadow: state.isFocused
      ? "0 4px 6px rgba(50, 50, 93, 0.11), 0 1px 3px rgba(0, 0, 0, 0.08)"
      : "none",
    ":hover": {
      borderColor: "#56BCB6",
    },
  }),

  menu: (provided) => ({
    ...provided,
    zIndex: 1050,
    borderRadius: "0.25rem",
    border: "1px solid #dee2e6",
    backgroundColor: "#fff",
    boxShadow: "0 3px 2px rgba(233, 236, 239, 0.05)",
    marginTop: 0,
    overflow: "hidden",
  }),

  menuList: (provided) => ({
    ...provided,
    padding: 0,
  }),

  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isFocused ? "#56BCB6" : "#fff",
    color: state.isFocused ? "#fff" : "#8898aa",
    fontSize: "0.875rem",
    padding: "0.625rem 0.75rem",
    cursor: "pointer",
  }),

  placeholder: (provided) => ({
    ...provided,
    color: "#8898aa",
    fontSize: "0.875rem",
    textAlign: "left",
  }),

  singleValue: (provided) => ({
    ...provided,
    color: "#212529",
    fontSize: "0.875rem",
    textAlign: "left",
  }),

  dropdownIndicator: (provided) => ({
    ...provided,
    color: "#8898aa",
    ":hover": { color: "#56BCB6" },
  }),

  indicatorSeparator: () => ({ display: "none" }),
};

const CustomSelect = ({
  options,
  value,
  onChange,
  placeholder,
  isOptional = false,
  readOnly = false,
  isDisabled = false,
  classNamePrefix = "rs",
  ...rest
}) => {
  const disabled = readOnly || isDisabled;

  const isWarning =
    !isOptional &&
    (!value || value.value === "" || value.value === undefined || value.value === null);

  const customStyles = {
    ...baseCustomStyles,

    control: (provided, state) => {
      const base = baseCustomStyles.control(provided, state);
      const border = isWarning
        ? "1px solid #f3b239"
        : state.isFocused
        ? "1px solid #56BCB6"
        : "1px solid #dee2e6";

      if (disabled) {
        return {
          ...base,
          border,
          backgroundColor: "#e9e9e9",
          color: "#000",
          opacity: 1,
          cursor: "not-allowed",
          boxShadow: "none",
          ":hover": { borderColor: isWarning ? "#f3b239" : "#dee2e6" },
        };
      }

      return {
        ...base,
        border,
        ":hover": { borderColor: isWarning ? "#f3b239" : "#56BCB6" },
      };
    },

    option: (provided, state) => ({
      ...baseCustomStyles.option(provided, state),
      cursor: disabled ? "not-allowed" : "pointer",
    }),
  };

  const handleChange = (val, meta) => {
    if (disabled) return;
    onChange(val, meta);
  };

  return (
    <Select
      options={options}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      styles={customStyles}
      isSearchable={!disabled}
      isDisabled={disabled}
      classNamePrefix={classNamePrefix}
      {...rest}
    />
  );
};

CustomSelect.propTypes = {
  options: PropTypes.array.isRequired,
  value: PropTypes.object,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
  isOptional: PropTypes.bool,
  readOnly: PropTypes.bool,
  isDisabled: PropTypes.bool,
  classNamePrefix: PropTypes.string,
};

CustomSelect.defaultProps = {
  placeholder: "Select an option",
  readOnly: false,
  isDisabled: false,
  classNamePrefix: "rs",
};

export default CustomSelect;
