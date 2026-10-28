import { read } from '../_session';
export default function handler(req, res) { res.json({ user: read(req) }); }
