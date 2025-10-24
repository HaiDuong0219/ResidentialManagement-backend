export const getAllUsers = (req, res) => {
  res.status(200).send("get"); //chắc vậy
};

export const createUser = (req, res) => {
  res.status(201).json({ message: "create" }); //chắc vậy
};

export const updateUser = (req, res) => {
  res.status(200).json({ message: "update" }); //chắc vậy
};

export const deleteUser = (req, res) => {
  res.status(200).json({ message: "delete" }); //chắc vậy
};