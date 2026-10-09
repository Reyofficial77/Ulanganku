import type { VercelRequest,VercelResponse } from '@vercel/node';import { read } from '../_session';export default function handler(req:VercelRequest,res:VercelResponse){res.json({user:read(req)})}
