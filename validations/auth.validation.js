const Joi = require("joi");

exports.signupSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().pattern(new RegExp("^(?=.*[a-zA-Z])(?=.*[0-9]).{6,}$")).required()
    .messages({ "string.pattern.base": "Password must include letters and numbers" }),
  name: Joi.string().min(2).max(30).optional()
});

exports.loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required(),
  password: Joi.string().required()
});