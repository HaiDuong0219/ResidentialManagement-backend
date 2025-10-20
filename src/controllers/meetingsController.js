export const getAllMeetings = (req, res) => {
  res.send('Get all meetings');
}

export const getMeetingById = (req, res) => {
  const { id } = req.params;
  res.send(`Get meeting with ID: ${id}`);
}

export const createMeeting = (req, res) => {
  res.send('Create a new meeting');
}

export const updateMeeting = (req, res) => {
  const { id } = req.params;
  res.send(`Update meeting with ID: ${id}`);
}

export const deleteMeeting = (req, res) => {
  const { id } = req.params;
  res.send(`Delete meeting with ID: ${id}`);
}
