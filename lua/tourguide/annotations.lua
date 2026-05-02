local state = require("tourguide.state")
local resolve = require("tourguide.resolve")

local M = {}

local function define_highlights()
  vim.api.nvim_set_hl(0, "TourGuidePrefix", { link = "DiagnosticInfo", default = true })
  vim.api.nvim_set_hl(0, "TourGuideNote", { link = "Comment", default = true })
  vim.api.nvim_set_hl(0, "TourGuideFlowSection", { link = "Search", default = true })
end

local function clamp_line(buf, line)
  local count = vim.api.nvim_buf_line_count(buf)
  return math.max(0, math.min(count - 1, line - 1))
end

function M.clear(buf)
  if buf and vim.api.nvim_buf_is_valid(buf) then
    vim.api.nvim_buf_clear_namespace(buf, state.ns, 0, -1)
  end
end

function M.apply(buf, sections)
  define_highlights()
  M.clear(buf)
  local first = nil

  for _, section in ipairs(sections or {}) do
    local start_line, end_line = resolve.section(buf, section)
    first = first or start_line

    for line = start_line, end_line do
      vim.api.nvim_buf_set_extmark(buf, state.ns, clamp_line(buf, line), 0, {
        line_hl_group = section.hl or "Visual"
      })
    end

    if section.note then
      local placement = section.placement or "above"
      local target = placement == "below" and end_line or start_line
      local opts
      if placement == "eol" or placement == "inline" then
        opts = {
          virt_text = {
            { "  >> TourGuide", "TourGuidePrefix" },
            { ": " .. section.note, "TourGuideNote" }
          },
          virt_text_pos = "eol"
        }
      else
        opts = {
          virt_lines = {
            {
              { ">> TourGuide", "TourGuidePrefix" },
              { ": " .. section.note, "TourGuideNote" }
            }
          },
          virt_lines_above = placement ~= "below"
        }
      end
      vim.api.nvim_buf_set_extmark(buf, state.ns, clamp_line(buf, target), 0, opts)
    end
  end

  return first
end

return M
