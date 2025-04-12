const Joi = require("joi");

exports.signupSchema = Joi.object({
  email: Joi.string().email().lowercase().required().messages({
    "string.email": "Please enter a valid email address",
    "any.required": "Email is required"
  }),

  password: Joi.string()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
    .required()
    .messages({
      "string.pattern.base": "Password must contain at least 8 characters, including uppercase, lowercase, number and special character",
      "any.required": "Password is required"
    }),

  confirmPassword: Joi.string()
    .valid(Joi.ref('password'))
    .required()
    .messages({
      "any.only": "Passwords do not match",
      "any.required": "Confirm password is required"
    }),

  name: Joi.string().min(2).max(50).required().messages({
    "string.min": "Name must be at least 2 characters",
    "string.max": "Name must be less than 50 characters",
    "any.required": "Name is required"
  }),

  phone: Joi.string()
    .pattern(/^(\+\d{1,3}[- ]?)?\d{10,14}$/)
    .required()
    .messages({
      "string.pattern.base": "Please enter a valid phone number (10-14 digits with optional country code)",
      "any.required": "Phone number is required"
    })
});
