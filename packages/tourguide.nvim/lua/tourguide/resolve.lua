local M = {}

local function line_count(buf)
  return vim.api.nvim_buf_line_count(buf)
end

function M.section(buf, section)
  if section.range then
    return section.range[1], section.range[2] or section.range[1]
  end

  local needle = section.search or section.symbol
  if needle then
    local lines = vim.api.nvim_buf_get_lines(buf, 0, -1, false)
    for i, line in ipairs(lines) do
      if line:find(needle, 1, true) then
        local extra = section.context or 8
        return i, math.min(line_count(buf), i + extra)
      end
    end
  end

  return 1, math.min(line_count(buf), 1)
end

return M
